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
import {
  appendJsonlRow,
  ensureDir,
  ensureDirSync,
  readJsonlAsync,
  writeJsonl,
} from './utils/fs.js';

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
export interface LedgerConfig<T extends BaseLedgerEntry, I = T> {
  /** Base directory for JSONL files. */
  basePath: string;
  /** Zod schema for entry validation (extends BaseLedgerEntrySchema). */
  schema: z.ZodType<T, I>;
  /** Rotation/rollover policy (all fields optional, defaults applied). */
  rollover?: RolloverPolicy;
  /** In-memory retention window for hot queries (ms). Default: 5 minutes; `0` disables the hot cache. */
  hotRetentionMs?: number;
  /** Hard cap on hot-cache entries, so a burst inside one retention window cannot grow without bound. Default: 10 000. */
  hotCacheMaxSize?: number;
  /**
   * Retain every appended entry for synchronous reads, up to `maxSize`.
   *
   * The hot cache expires, and {@link Ledger.query} is async, so a caller that
   * needs a synchronous view of what it has written — a parameter table read on
   * the CLI's own thread, a calibration fit over the labels just recorded — had
   * no way to get one. Five wrappers each answered it by keeping their own
   * parallel array beside the ledger: unbounded, never trimmed, and holding the
   * *pre-validation* row while the file held the validated one. The mirror is
   * that view, owned here and bounded here.
   *
   * Opt-in because it costs an entry per append; omit it and the ledger writes
   * to disk alone.
   */
  mirror?: { maxSize?: number };
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
export type CreateLedgerOptions<T extends BaseLedgerEntry, I = T> = Omit<
  LedgerConfig<T, I>,
  'basePath' | 'schema'
>;

/**
 * A ledger entry as a producer supplies it, typed by the schema's *input* side.
 *
 * `at` is stamped by the ledger, so a caller that has no timestamp to offer does
 * not write the fallback itself. Four wrappers each open-coded
 * `{ ...entry, at: entry.at ?? Date.now() }` and cast the result to the entry type,
 * which is `append`'s own line restated.
 *
 * Derived from `I` rather than `T` so a field the schema *fills in* — a default,
 * a coercion — is optional here. Typed from the output it would look required and
 * push the very cast this type exists to delete back onto the caller.
 */
export type LedgerInput<T extends BaseLedgerEntry, I = T> = Omit<I, 'at'> & { at?: number };

/**
 * Internal config with every default applied.
 */
interface ResolvedLedgerConfig<T extends BaseLedgerEntry, I> {
  basePath: string;
  schema: z.ZodType<T, I>;
  rollover: ResolvedRollover;
  hotRetentionMs: number;
  hotCacheMaxSize: number;
  /** `0` = no mirror; a synchronous read then reports nothing. */
  mirrorMaxSize: number;
  onWrite: (entry: T) => void | Promise<void>;
  onRead: (entry: T) => void | Promise<void>;
}

/** The mirror's default ceiling — a window of history, not a second source of truth. */
export const DEFAULT_MIRROR_SIZE = 10_000;

/**
 * Generic append-only ledger with JSONL backing, rotation, retention, and in-memory hot cache.
 */
export class Ledger<T extends BaseLedgerEntry, I = T> {
  readonly #config: ResolvedLedgerConfig<T, I>;
  /** Append-ordered by construction: the key is the append sequence, so eviction drops the oldest. */
  readonly #hotCache: BoundedMap<number, T>;
  /**
   * Append-ordered synchronous window of what this ledger has written, holding the
   * *validated* row. A `BoundedMap` keyed by the append sequence, so eviction
   * drops the oldest and the ordering is the one the file has.
   */
  readonly #mirror: BoundedMap<number, T> | null;
  #hotSeq = 0;
  #currentFile: string | null = null;
  #currentDay: string | null = null;
  #rolloverIndex = 0;
  #currentEntries = 0;

  constructor(config: LedgerConfig<T, I>) {
    const rollover = config.rollover ?? {};
    const hotRetentionMs = config.hotRetentionMs ?? 5 * 60 * 1000;
    const mirrorMaxSize = config.mirror?.maxSize ?? (config.mirror ? DEFAULT_MIRROR_SIZE : 0);
    this.#config = {
      basePath: config.basePath,
      schema: config.schema,
      rollover: {
        ...DEFAULT_ROLLOVER,
        ...rollover,
        pathTemplate:
          rollover.pathTemplate ??
          ((date, index) => (index === 0 ? `${date}.jsonl` : `${date}-${index}.jsonl`)),
      },
      hotRetentionMs,
      hotCacheMaxSize: Math.max(1, config.hotCacheMaxSize ?? 10_000),
      mirrorMaxSize: Math.max(0, mirrorMaxSize),
      onWrite: config.onWrite ?? (() => {}),
      onRead: config.onRead ?? (() => {}),
    };

    this.#hotCache = new BoundedMap<number, T>({
      maxSize: this.#config.hotCacheMaxSize,
      // A non-positive window is the documented way to turn the hot cache off, and
      // a `ttlMs` of 0 would expire every entry on the next read.
      ttlMs: hotRetentionMs > 0 ? hotRetentionMs : Number.POSITIVE_INFINITY,
    });
    this.#mirror =
      mirrorMaxSize > 0
        ? new BoundedMap<number, T>({
            maxSize: mirrorMaxSize,
            // The mirror is bounded by count alone. A TTL would make a synchronous
            // read answer differently depending on when it was asked.
            ttlMs: Number.POSITIVE_INFINITY,
            // Recency refresh is the hot cache's business; the mirror is a window
            // over append order, so eviction must not depend on who read last.
            eviction: 'fifo',
            touchOnRead: false,
          })
        : null;
  }

  /**
   * Append an entry to the ledger (validates via schema, writes to JSONL), and
   * return the validated row.
   *
   * The return value is the ledger's answer, not the caller's draft: `at` is
   * stamped here, the schema's defaults and coercions are applied, and unknown
   * keys are stripped. A caller that needs the row it wrote reads it here rather
   * than reconstructing it, which is how a pre-validation row came to sit beside
   * its validated twin.
   */
  append(input: LedgerInput<T, I>): T {
    const validated = this.#config.schema.parse({ at: Date.now(), ...input });
    const seq = this.#hotSeq++;
    if (this.#config.hotRetentionMs > 0) this.#hotCache.set(seq, validated);
    this.#mirror?.set(seq, validated);
    this.#writeToFile(validated);
    this.#config.onWrite(validated);
    return validated;
  }

  /**
   * What this ledger has written, synchronously and in append order.
   *
   * The synchronous counterpart to {@link query}, bounded by `mirror.maxSize`;
   * empty unless the mirror was requested. Disk remains authoritative for
   * history — this is the recent window a caller reads between awaits.
   */
  records(): readonly T[] {
    return this.#mirror?.toArray() ?? [];
  }

  /** Replace the mirror with entries read back from disk, so a reload continues the window. */
  loadMirror(entries: readonly T[]): void {
    this.#mirror?.clear();
    for (const entry of entries) this.#mirror?.set(this.#hotSeq++, entry);
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
    let hotMatches: T[] | undefined;
    const cached = (): T[] =>
      (hotMatches ??= this.#hotCache.toArray().filter((e) => this.#matchesFilter(e, filter)));

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

    // Reset in-memory state to what the files now hold, so a compaction is
    // observable through `query` and through the synchronous mirror alike.
    this.#hotCache.clear();
    for (const entry of byKey.values()) this.#hotCache.set(this.#hotSeq++, entry);
    this.#mirror?.clear();
    for (const entry of byKey.values()) this.#mirror?.set(this.#hotSeq++, entry);
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

  /** Release the in-memory views. Every entry is already durable on disk. */
  close(): void {
    this.#hotCache.clear();
    this.#mirror?.clear();
  }

  /** Clear all entries (in-memory views and files). */
  async clear(): Promise<void> {
    this.#hotCache.clear();
    this.#mirror?.clear();
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
      appendJsonlRow(targetFile, entry);
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
export function createLedger<T extends BaseLedgerEntry, I = T>(
  basePath: string,
  schema: z.ZodType<T, I>,
  options: CreateLedgerOptions<T> = {}
): Ledger<T, I> {
  return new Ledger({ basePath, schema, ...options });
}
