/**
 * Generic Ledger primitive (REFACTOR.todo4 Phase B).
 * Replaces ~12 bespoke append-only JSONL implementations with one reusable primitive.
 * ParameterLedger is the in-tree prototype; this generalizes its shape.
 */
import { z } from 'zod';
/**
 * Ledger entry schema — all entries carry a timestamp and correlation context.
 * Subclasses extend this with their domain-specific fields via Zod composition.
 */
export declare const BaseLedgerEntrySchema: z.ZodObject<{
    at: z.ZodNumber;
    correlationId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
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
/**
 * The ledger's default rollover: one file per day, ten thousand entries in it,
 * thirty days of history. Every field is a bound on disk growth rather than a
 * preference, so a caller states a different one deliberately or takes this.
 *
 * Declared here because the constructor reads it: the value a `Ledger` gets for
 * an omitted field and the value a caller can name are the same number, not two
 * that can drift.
 */
export declare const DEFAULT_ROLLOVER: Readonly<{
    daily: true;
    maxEntriesPerFile: 10000;
    retentionDays: 30;
}>;
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
     *
     * `onEvict` fires when the window drops a row, which is how a caller releases
     * whatever it kept *beside* the ledger for that row — a decoded embedding, a
     * pooled buffer. A side structure with its own lifetime drifts from the window
     * that was supposed to bound it, which is how an unbounded index survived next
     * to a bounded ledger.
     */
    mirror?: {
        maxSize?: number;
        onEvict?: (entry: T) => void;
    };
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
export type CreateLedgerOptions<T extends BaseLedgerEntry, I = T> = Omit<LedgerConfig<T, I>, 'basePath' | 'schema'>;
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
export type LedgerInput<T extends BaseLedgerEntry, I = T> = Omit<I, 'at'> & {
    at?: number;
};
/** The mirror's default ceiling — a window of history, not a second source of truth. */
export declare const DEFAULT_MIRROR_SIZE = 10000;
/**
 * Generic append-only ledger with JSONL backing, rotation, retention, and in-memory hot cache.
 */
export declare class Ledger<T extends BaseLedgerEntry, I = T> {
    #private;
    constructor(config: LedgerConfig<T, I>);
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
    append(input: LedgerInput<T, I>): T;
    /**
     * What this ledger has written, synchronously and in append order.
     *
     * The synchronous counterpart to {@link query}, bounded by `mirror.maxSize`;
     * empty unless the mirror was requested. Disk remains authoritative for
     * history — this is the recent window a caller reads between awaits.
     */
    records(): readonly T[];
    /**
     * Records appended after `seq`, and the sequence to ask from next time.
     *
     * The mirror is keyed by the append sequence for exactly this: a caller
     * mirroring this ledger somewhere else — an auto-flushed export file — needs
     * "what is new", and the two ways to get it without a sequence are to re-send
     * the whole window (so an every-thirty-seconds flush rewrites fifty thousand
     * rows) and to diff the entries by content.
     *
     * `seq` starts at `0`. Keys ascend, so a cursor older than the window's floor
     * returns the whole window: the rows evicted before it are the ones a bounded
     * mirror drops, and re-sending the rest is closer than silently sending none.
     */
    recordsSince(seq: number): {
        entries: readonly T[];
        seq: number;
    };
    /**
     * How many records the mirror holds.
     *
     * Not `records().length`: two callers ask this for a count on paths that run
     * per judgment and per command, and materializing a fifty-thousand-entry
     * window to throw it away is the query they were avoiding.
     */
    get size(): number;
    /** Replace the mirror with entries read back from disk, so a reload continues the window. */
    loadMirror(entries: readonly T[]): void;
    /**
     * Query entries with optional filters. The hot cache answers when it is
     * sufficient; otherwise disk is authoritative — every append is written
     * synchronously, so disk rows already contain the cached ones.
     */
    query(filter?: LedgerQuery): Promise<T[]>;
    /** Rotate to a new file (daily rollover or cap reached). */
    rotate(): void;
    /** Compact the ledger: dedupe by a key selector, rewrite files. */
    compact(keySelector: (entry: T) => string): Promise<{
        kept: number;
        dropped: number;
    }>;
    /** Get the current file path. */
    getCurrentFile(): string | null;
    /** Get the base directory path. */
    getBasePath(): string;
    /** Get hot cache size. */
    getHotCacheSize(): number;
    /** Release the in-memory views. Every entry is already durable on disk. */
    close(): void;
    /** Clear all entries (in-memory views and files). */
    clear(): Promise<void>;
    /** Invalidate hot cache (force next query to read from disk). */
    invalidateHotCache(): void;
    /** Run the retention sweep manually (deletes files older than retentionDays). */
    runRetentionSweep(): Promise<void>;
}
/**
 * Convenience factory for common ledger shapes.
 */
export declare function createLedger<T extends BaseLedgerEntry, I = T>(basePath: string, schema: z.ZodType<T, I>, options?: CreateLedgerOptions<T>): Ledger<T, I>;
//# sourceMappingURL=ledger.d.ts.map