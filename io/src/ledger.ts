/**
 * Generic Ledger primitive (REFACTOR.todo4 Phase B).
 * Replaces ~12 bespoke append-only JSONL implementations with one reusable primitive.
 * ParameterLedger is the in-tree prototype; this generalizes its shape.
 */

import { appendFileSync, mkdirSync, readFileSync, promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

/**
 * Ledger entry schema — all entries carry a timestamp and correlation context.
 * Subclasses extend this with their domain-specific fields via Zod composition.
 */
export const BaseLedgerEntrySchema = z.object({
  /** Unix epoch milliseconds. */
  at: z.number(),
  /** Correlation ID for traceability across subsystems. */
  correlationId: z.string().optional(),
  /** Session ID for dialogue/session-scoped ledgers. */
  sessionId: z.string().optional(),
});

export type BaseLedgerEntry = z.infer<typeof BaseLedgerEntrySchema>;

/**
 * Rotation/rollover policy — parameterized from EpisodicMemory's load-bearing behavior.
 */
export interface RolloverPolicy {
  /** Daily rollover: new file per date. */
  daily: boolean;
  /** Per-file entry cap; rolls to `<date>-<n>.jsonl` when reached. */
  maxEntriesPerFile: number;
  /** Retention: delete files older than this many days. */
  retentionDays: number;
  /** Custom path template. Default: `<basePath>/<date>[-<n>].jsonl`. */
  pathTemplate: (date: string, index: number) => string;
  /** If set, writes to a single fixed file instead of daily rollover. Disables rollover/retention. */
  fixedFile?: string;
}

/** Factory options for rollover policy (all optional, defaults applied). */
export interface RolloverPolicyOptions {
  /** Daily rollover: new file per date. */
  daily?: boolean;
  /** Per-file entry cap; rolls to `<date>-<n>.jsonl` when reached. */
  maxEntriesPerFile?: number;
  /** Retention: delete files older than this many days. */
  retentionDays?: number;
  /** Custom path template. Default: `<basePath>/<date>[-<n>].jsonl`. */
  pathTemplate?: (date: string, index: number) => string;
  /** If set, writes to a single fixed file instead of daily rollover. Disables rollover/retention. */
  fixedFile?: string;
}

/**
 * Query filter for ledger entries.
 */
export interface LedgerQuery {
  correlationId?: string;
  sessionId?: string;
  since?: number;
  until?: number;
  limit?: number;
}

/**
 * Ledger configuration.
 */
export interface LedgerConfig<T extends BaseLedgerEntry> {
  /** Base directory for JSONL files. */
  basePath: string;
  /** Zod schema for entry validation (extends BaseLedgerEntrySchema). */
  schema: z.ZodType<T>;
  /** Rotation/rollover policy (all fields optional, defaults applied). */
  rollover?: Partial<RolloverPolicy>;
  /** In-memory retention window for hot queries (ms). Default: 5 minutes. */
  hotRetentionMs?: number;
  /** Optional pre-write hook (e.g., for sidecar updates like JudgmentDataset vectors). */
  onWrite?: (entry: T) => void | Promise<void>;
  /** Optional post-read hook for enriching entries (e.g., loading sidecar vectors). */
  onRead?: (entry: T) => void | Promise<void>;
}

/** Factory options for createLedger (excludes basePath and schema which are separate params). */
export interface CreateLedgerOptions<T extends BaseLedgerEntry> {
  /** Rotation/rollover policy (all fields optional, defaults applied). */
  rollover?: RolloverPolicyOptions;
  /** In-memory retention window for hot queries (ms). Default: 5 minutes. */
  hotRetentionMs?: number;
  /** Optional pre-write hook (e.g., for sidecar updates like JudgmentDataset vectors). */
  onWrite?: (entry: T) => void | Promise<void>;
  /** Optional post-read hook for enriching entries (e.g., loading sidecar vectors). */
  onRead?: (entry: T) => void | Promise<void>;
}

/** Internal config with all rollover fields required. */
interface ResolvedLedgerConfig<T extends BaseLedgerEntry> {
  basePath: string;
  schema: z.ZodType<T>;
  rollover: RolloverPolicy;
  hotRetentionMs: number;
  onWrite: (entry: T) => void | Promise<void>;
  onRead: (entry: T) => void | Promise<void>;
}

/**
 * Generic append-only ledger with JSONL backing, rotation, retention, and in-memory hot cache.
 */
export class Ledger<T extends BaseLedgerEntry> {
  readonly #config: ResolvedLedgerConfig<T>;
  readonly #hotCache: T[] = [];
  #currentFile: string | null = null;
  #currentDay: string | null = null;
  #rolloverIndex = 0;
  #currentEntries = 0;
  #hotCacheTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: LedgerConfig<T>) {
    const rollover = config.rollover ?? {};
    const fixedFile = rollover.fixedFile;
    this.#config = {
      basePath: config.basePath,
      schema: config.schema,
      rollover: {
        daily: fixedFile ? false : (rollover.daily ?? true),
        maxEntriesPerFile: fixedFile ? Number.MAX_SAFE_INTEGER : (rollover.maxEntriesPerFile ?? 10_000),
        retentionDays: fixedFile ? 0 : (rollover.retentionDays ?? 30),
        pathTemplate:
          rollover.pathTemplate ??
          ((date, index) => (index === 0 ? `${date}.jsonl` : `${date}-${index}.jsonl`)),
        fixedFile,
      },
      hotRetentionMs: config.hotRetentionMs ?? 5 * 60 * 1000,
      onWrite: config.onWrite ?? (() => {}),
      onRead: config.onRead ?? (() => {}),
    };

    // Start hot cache eviction timer (skip if fixedFile mode)
    if (!fixedFile) {
      this.#hotCacheTimer = setInterval(() => this.#evictHotCache(), this.#config.hotRetentionMs);
      this.#hotCacheTimer.unref?.();
    }
  }

  /** Append an entry to the ledger (validates via schema, writes to JSONL). */
  append(entry: T): void {
    const validated = this.#config.schema.parse({ ...entry, at: entry.at ?? Date.now() });
    this.#hotCache.push(validated);
    this.#writeToFile(validated);
    this.#config.onWrite(validated);
  }

  /** Query entries with optional filters. Checks hot cache first, then falls back to disk scan. */
  async query(filter: LedgerQuery = {}): Promise<T[]> {
    const { correlationId, sessionId, since, until, limit } = filter;

    // Fast path: hot cache
    const cacheMatches = this.#hotCache.filter((e) => this.#matchesFilter(e, filter));
    if (cacheMatches.length >= (limit ?? Number.POSITIVE_INFINITY)) {
      return cacheMatches.slice(0, limit);
    }

    const { fixedFile } = this.#config.rollover;

    // Fallback: scan disk
    const diskMatches: T[] = [];
    try {
      let filesToScan: string[];
      if (fixedFile) {
        // Fixed file mode: read only the fixed file
        filesToScan = [fixedFile];
      } else {
        // Rollover mode: scan directory for date files (newest first)
        const files = await fs.readdir(this.#config.basePath);
        filesToScan = files
          .filter((f) => f.endsWith('.jsonl'))
          .sort()
          .reverse();
      }

      for (const file of filesToScan) {
        if (diskMatches.length >= (limit ?? Number.POSITIVE_INFINITY)) break;

        const filePath = fixedFile ? file : join(this.#config.basePath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(Boolean);

        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          if (!line) continue;
          try {
            const entry = this.#config.schema.parse(JSON.parse(line));
            if (this.#matchesFilter(entry, filter)) {
              this.#config.onRead(entry);
              diskMatches.push(entry);
              if (diskMatches.length >= (limit ?? Number.POSITIVE_INFINITY)) break;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch {
      // Directory may not exist yet / file may not exist
    }

    // Merge: hot cache entries are newer, so they win on dedupe by (correlationId, at)
    const merged = [...cacheMatches];
    const seen = new Set(cacheMatches.map((e) => `${e.correlationId ?? ''}:${e.at}`));
    for (const e of diskMatches) {
      const key = `${e.correlationId ?? ''}:${e.at}`;
      if (!seen.has(key)) {
        merged.push(e);
        seen.add(key);
      }
    }

    return merged.slice(0, limit);
  }

  /** Rotate to a new file (daily rollover or cap reached). */
  rotate(): void {
    this.#currentFile = null;
    this.#currentEntries = 0;
    this.#rolloverIndex = 0;
    return;
  }

  /** Compact the ledger: dedupe by a key selector, rewrite files. */
  async compact(keySelector: (entry: T) => string): Promise<{ kept: number; dropped: number }> {
    const all = await this.query({});
    const byKey = new Map<string, T>();
    let dropped = 0;

    for (const entry of all) {
      const key = keySelector(entry);
      if (byKey.has(key)) dropped++;
      byKey.set(key, entry);
    }

    const { fixedFile } = this.#config.rollover;

    if (fixedFile) {
      // Fixed file mode: rewrite the single file
      const lines = [...byKey.values()].map((e) => JSON.stringify(e)).join('\n') + '\n';
      await fs.writeFile(fixedFile, lines, 'utf-8');

      // Reset hot cache
      this.#hotCache.length = 0;
      this.#hotCache.push(...byKey.values());

      return { kept: byKey.size, dropped };
    }

    // Rollover mode: rewrite all files
    await fs.rm(this.#config.basePath, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(this.#config.basePath, { recursive: true });

    const date = new Date().toISOString().split('T')[0]!;
    const fileName = this.#config.rollover.pathTemplate(date, 0);
    const targetFile = join(this.#config.basePath, fileName);
    const lines = [...byKey.values()].map((e) => JSON.stringify(e)).join('\n') + '\n';
    await fs.writeFile(targetFile, lines, 'utf-8');

    // Reset hot cache and file state
    this.#hotCache.length = 0;
    this.#hotCache.push(...byKey.values());
    this.#currentFile = targetFile;
    this.#currentDay = date;
    this.#currentEntries = byKey.size;
    this.#rolloverIndex = 0;

    return { kept: byKey.size, dropped };
  }

  /** Get the current file path. */
  getCurrentFile(): string | null {
    return this.#currentFile;
  }

  /** Get the base directory path. */
  getBasePath(): string {
    return this.#config.basePath;
  }

  /** Get hot cache size. */
  getHotCacheSize(): number {
    return this.#hotCache.length;
  }

  /** Close the ledger (stop timers, flush). */
  close(): void {
    if (this.#hotCacheTimer) {
      clearInterval(this.#hotCacheTimer);
      this.#hotCacheTimer = null;
    }
  }

  /** Run the retention sweep manually (deletes files older than retentionDays). */
  async runRetentionSweep(): Promise<void> {
    await this.#pruneOldFiles();
  }

  // ─── Private ───

  #matchesFilter(entry: T, filter: LedgerQuery): boolean {
    if (filter.correlationId && entry.correlationId !== filter.correlationId) return false;
    if (filter.sessionId && entry.sessionId !== filter.sessionId) return false;
    if (filter.since && entry.at < filter.since) return false;
    if (filter.until && entry.at > filter.until) return false;
    return true;
  }

  #writeToFile(entry: T): void {
    const { fixedFile } = this.#config.rollover;

    if (fixedFile) {
      // Fixed file mode: write directly to the specified file
      const targetFile = fixedFile;
      try {
        mkdirSync(dirname(targetFile), { recursive: true });
        appendFileSync(targetFile, JSON.stringify(entry) + '\n', 'utf-8');
      } catch (error) {
        throw new Error(`Ledger write failed: ${(error as Error).message}`);
      }
      return;
    }

    // Rollover mode (original logic)
    const today = new Date().toISOString().split('T')[0]!;

    // Daily rollover
    if (today !== this.#currentDay) {
      this.#currentDay = today;
      this.#rolloverIndex = 0;
      // Retention sweep piggybacked on daily rollover
      if (this.#config.rollover.retentionDays) {
        void this.#pruneOldFiles().catch(() => {});
      }
    }

    const fileName = this.#config.rollover.pathTemplate(this.#currentDay!, this.#rolloverIndex);
    const targetFile = join(this.#config.basePath, fileName);

    if (this.#currentFile !== targetFile) {
      this.#currentFile = targetFile;
      this.#currentEntries = 0;
      // Ensure directory exists
      try {
        mkdirSync(this.#config.basePath, { recursive: true });
      } catch {
        // ignore
      }
    }

    // Per-file cap rollover
    if (this.#currentEntries >= (this.#config.rollover.maxEntriesPerFile ?? 10_000)) {
      this.#rolloverIndex++;
      this.#currentFile = null;
      this.#writeToFile(entry);
      return;
    }

    try {
      appendFileSync(targetFile, JSON.stringify(entry) + '\n', 'utf-8');
      this.#currentEntries++;
    } catch (error) {
      throw new Error(`Ledger write failed: ${(error as Error).message}`);
    }
  }

  async #pruneOldFiles(): Promise<void> {
    const { retentionDays } = this.#config.rollover;
    if (!retentionDays) return;

    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    try {
      const files = await fs.readdir(this.#config.basePath);
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})(?:-\d+)?\.jsonl/);
        if (!dateMatch) continue;

        const dateStr = dateMatch[1];
        if (!dateStr) continue;
        const fileDate = new Date(dateStr).getTime();
        if (fileDate < cutoff) {
          await fs.unlink(join(this.#config.basePath, file)).catch(() => {});
        }
      }
    } catch {
      // Directory may not exist
    }
  }

  #evictHotCache(): void {
    const now = Date.now();
    const cutoff = now - this.#config.hotRetentionMs;
    // Keep only entries newer than cutoff
    let i = 0;
    while (i < this.#hotCache.length && (this.#hotCache[i]?.at ?? 0) < cutoff) i++;
    if (i > 0) this.#hotCache.splice(0, i);
  }
}

/**
 * Convenience factory for common ledger shapes.
 */
export function createLedger<T extends BaseLedgerEntry>(
  basePath: string,
  schema: z.ZodType<T>,
  options: CreateLedgerOptions<T> = {}
): Ledger<T> {
  return new Ledger({ basePath, schema, ...options });
}