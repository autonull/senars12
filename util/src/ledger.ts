/**
 * Generic Ledger primitive (REFACTOR.todo4 Phase B).
 * Replaces ~12 bespoke append-only JSONL implementations with one reusable primitive.
 * ParameterLedger is the in-tree prototype; this generalizes its shape.
 */

import { existsSync, promises as fs, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { BoundedMap } from './utils/bounded-map.js';
import { errMsg } from './utils/error.js';
import { utcDate } from './utils/format.js';
import { appendJsonl, ensureDir, ensureDirSync, readJsonlAsync, writeJsonl } from './utils/fs.js';

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
 * Every field optional: each is a bound on disk growth with a default, so a
 * caller states a different one deliberately or says nothing.
 */
export interface RolloverPolicy {
  /** Daily rollover: new file per date. */
  daily?: boolean;
  /** Per-file entry cap; rolls to `<date>-<n>.jsonl` when reached. */
  maxEntriesPerFile?: number;
  /** Retention: delete files older than this many days. */
  retentionDays?: number;
  /** Custom path template. Default: `<basePath>/<date>[-<n>].jsonl`. */
  pathTemplate?: (date: string, index: number) => string;
}

/** Rollover with every field filled — what the ledger actually runs on. */
type ResolvedRollover = Required<RolloverPolicy>;

/**
 * The ledger's default rollover: one file per day, ten thousand entries in it,
 * thirty days of history. Every field is a bound on disk growth rather than a
 * preference, so a caller states a different one deliberately or takes this.
 *
 * Declared here because the constructor reads it: the value a `Ledger` gets for
 * an omitted field and the value a caller can name are the same number, not two
 * that can drift.
 */
export const DEFAULT_ROLLOVER = Object.freeze({
  daily: true,
  maxEntriesPerFile: 10_000,
  retentionDays: 30,
});

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
  rollover?: RolloverPolicy;
  /** In-memory retention window for hot queries (ms). Default: 5 minutes; `0` disables the hot cache. */
  hotRetentionMs?: number;
  /** Hard cap on hot-cache entries, so a burst inside one retention window cannot grow without bound. Default: 10 000. */
  hotCacheMaxSize?: number;
  /** Optional pre-write hook (e.g., for sidecar updates like JudgmentDataset vectors). */
  onWrite?: (entry: T) => void | Promise<void>;
  /** Optional post-read hook for enriching entries (e.g., loading sidecar vectors). */
  onRead?: (entry: T) => void | Promise<void>;
}

/**
 * Factory options for `createLedger`: {@link LedgerConfig} without the two fields
 * it takes as its own parameters. They were a second field-for-field copy of the
 * optional half, with a doc line each to keep in step.
 */
export type CreateLedgerOptions<T extends BaseLedgerEntry> = Omit<
  LedgerConfig<T>,
  'basePath' | 'schema'
>;

/** Internal config with every default applied. */
interface ResolvedLedgerConfig<T extends BaseLedgerEntry> {
  basePath: string;
  schema: z.ZodType<T>;
  rollover: ResolvedRollover;
  hotRetentionMs: number;
  hotCacheMaxSize: number;
  onWrite: (entry: T) => void | Promise<void>;
  onRead: (entry: T) => void | Promise<void>;
}

/**
 * Generic append-only ledger with JSONL backing, rotation, retention, and in-memory hot cache.
 */
export class Ledger<T extends BaseLedgerEntry> {
  readonly #config: ResolvedLedgerConfig<T>;
  /** Append-ordered by construction: the key is the append sequence, so eviction drops the oldest. */
  readonly #hotCache: BoundedMap<number, T>;
  #hotSeq = 0;
  #currentFile: string | null = null;
  #currentDay: string | null = null;
  #rolloverIndex = 0;
  #currentEntries = 0;

  constructor(config: LedgerConfig<T>) {
    const rollover = config.rollover ?? {};
    const hotRetentionMs = config.hotRetentionMs ?? 5 * 60 * 1000;
    this.#config = {
      basePath: config.basePath,
      schema: config.schema,
      rollover: {
        ...DEFAULT_ROLLOVER,
        ...rollover,
        pathTemplate:
          rollover.pathTemplate ?? ((date, index) => (index === 0 ? `${date}.jsonl` : `${date}-${index}.jsonl`)),
      },
      hotRetentionMs,
      hotCacheMaxSize: Math.max(1, config.hotCacheMaxSize ?? 10_000),
      onWrite: config.onWrite ?? (() => {}),
      onRead: config.onRead ?? (() => {}),
    };

    this.#hotCache = new BoundedMap<number, T>({
      maxSize: this.#config.hotCacheMaxSize,
      // A non-positive window is the documented way to turn the hot cache off, and
      // a `ttlMs` of 0 would expire every entry on the next read.
      ttlMs: hotRetentionMs > 0 ? hotRetentionMs : Number.POSITIVE_INFINITY,
    });
  }

  /** Append an entry to the ledger (validates via schema, writes to JSONL). */
  append(entry: T): void {
    const validated = this.#config.schema.parse({ ...entry, at: entry.at ?? Date.now() });
    if (this.#config.hotRetentionMs > 0) this.#hotCache.set(this.#hotSeq++, validated);
    this.#writeToFile(validated);
    this.#config.onWrite(validated);
  }

  /**
   * Query entries with optional filters. The hot cache answers when it is
   * sufficient; otherwise disk is authoritative — every append is written
   * synchronously, so disk rows already contain the cached ones.
   */
  async query(filter: LedgerQuery = {}): Promise<T[]> {
    // Materializing the hot cache costs a full copy and a filter pass, so it is
    // deferred to the two cases that read it: a bounded query it can answer, and
    // the fallback when the ledger directory is unreadable.
    const cached = (): T[] =>
      this.#hotCache.toArray().filter((e) => this.#matchesFilter(e, filter));

    if (filter.limit !== undefined) {
      const cacheMatches = cached();
      if (cacheMatches.length >= filter.limit) return cacheMatches.slice(0, filter.limit);
    }

    const diskMatches = await this.#scanDisk(filter);
    if (diskMatches === null) return cached().slice(0, filter.limit);
    return diskMatches;
  }

  /**
   * Append-order scan of the rollover files (oldest first, `limit` takes the
   * oldest rows). `null` means the ledger directory is unreadable — the caller
   * falls back to the hot cache.
   */
  async #scanDisk(filter: LedgerQuery): Promise<T[] | null> {
    const { limit } = filter;
    const cap = limit ?? Number.POSITIVE_INFINITY;
    const matches: T[] = [];
    let files: string[];
    try {
      files = await fs.readdir(this.#config.basePath);
    } catch {
      return null;
    }

    const { schema, onRead } = this.#config;
    for (const file of files.filter((f) => f.endsWith('.jsonl')).sort()) {
      if (matches.length >= cap) break;
      const { rows } = await readJsonlAsync(join(this.#config.basePath, file), (value) => {
        const parsed = schema.safeParse(value);
        return parsed.success ? parsed.data : null;
      });
      for (const entry of rows) {
        if (!this.#matchesFilter(entry, filter)) continue;
        await onRead(entry);
        matches.push(entry);
        if (matches.length >= cap) break;
      }
    }
    return matches;
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

    // Rollover mode: rewrite all files
    await fs.rm(this.#config.basePath, { recursive: true, force: true }).catch(() => {});
    await ensureDir(this.#config.basePath);

    const date = utcDate();
    const fileName = this.#config.rollover.pathTemplate(date, 0);
    const targetFile = join(this.#config.basePath, fileName);
    await writeJsonl(targetFile, [...byKey.values()]);

    // Reset hot cache and file state
    this.#hotCache.clear();
    for (const entry of byKey.values()) this.#hotCache.set(this.#hotSeq++, entry);
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
    return this.#hotCache.size();
  }

  /** Release the hot cache. Every entry is already durable on disk. */
  close(): void {
    this.#hotCache.clear();
  }

  /** Clear all entries (hot cache and files). */
  async clear(): Promise<void> {
    this.#hotCache.clear();
    // In rollover mode, we clear by removing all files in the basePath
    await fs.rm(this.#config.basePath, { recursive: true, force: true }).catch(() => {});
  }

  /** Invalidate hot cache (force next query to read from disk). */
  invalidateHotCache(): void {
    this.#hotCache.clear();
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
    const today = utcDate();

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
      // A basePath that exists as a file is a misconfiguration. Deleting it here
      // would turn a typo into silent data loss, so the write refuses instead.
      const { basePath } = this.#config;
      if (existsSync(basePath) && !statSync(basePath).isDirectory()) {
        throw new Error(`Ledger basePath is not a directory: ${basePath}`);
      }
      ensureDirSync(basePath);
    }

    // Per-file cap rollover. A non-positive cap would reset the counter on every
    // attempt and recurse without end, so the floor is applied once here.
    if (this.#currentEntries >= Math.max(1, this.#config.rollover.maxEntriesPerFile)) {
      this.#rolloverIndex++;
      this.#currentFile = null;
      this.#writeToFile(entry);
      return;
    }

    try {
      appendJsonl(targetFile, [entry]);
      this.#currentEntries++;
    } catch (error) {
      throw new Error(`Ledger write failed: ${errMsg(error)}`);
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
