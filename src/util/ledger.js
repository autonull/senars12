/**
 * Generic Ledger primitive (REFACTOR.todo4 Phase B).
 * Replaces ~12 bespoke append-only JSONL implementations with one reusable primitive.
 * ParameterLedger is the in-tree prototype; this generalizes its shape.
 */
import { existsSync, promises as fs, statSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { BoundedMap } from './bounded-map';
import { collectUpTo, lastByKey, takeFirst } from './collections';
import { errMsg } from './error';
import { utcDate } from './format';
import { ALL_ROWS, appendJsonlRow, ensureDir, ensureDirSync, readJsonlAsync, writeJsonl, } from './fs';
import { SenarsError } from '../errors/senars-error';
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
/** The mirror's default ceiling — a window of history, not a second source of truth. */
export const DEFAULT_MIRROR_SIZE = 10_000;
/**
 * Generic append-only ledger with JSONL backing, rotation, retention, and in-memory hot cache.
 */
export class Ledger {
    #config;
    /** Append-ordered by construction: the key is the append sequence, so eviction drops the oldest. */
    #hotCache;
    /**
     * Append-ordered synchronous window of what this ledger has written, holding the
     * *validated* row. A `BoundedMap` keyed by the append sequence, so eviction
     * drops the oldest and the ordering is the one the file has.
     */
    #mirror;
    #hotSeq = 0;
    #currentFile = null;
    #currentDay = null;
    #rolloverIndex = 0;
    #currentEntries = 0;
    constructor(config) {
        const rollover = config.rollover ?? {};
        const hotRetentionMs = config.hotRetentionMs ?? 5 * 60 * 1000;
        const mirrorMaxSize = config.mirror?.maxSize ?? (config.mirror ? DEFAULT_MIRROR_SIZE : 0);
        this.#config = {
            basePath: config.basePath,
            schema: config.schema,
            rollover: {
                ...DEFAULT_ROLLOVER,
                ...rollover,
                pathTemplate: rollover.pathTemplate ??
                    ((date, index) => (index === 0 ? `${date}.jsonl` : `${date}-${index}.jsonl`)),
            },
            hotRetentionMs,
            hotCacheMaxSize: Math.max(1, config.hotCacheMaxSize ?? 10_000),
            mirrorMaxSize: Math.max(0, mirrorMaxSize),
            onWrite: config.onWrite ?? (() => { }),
            onRead: config.onRead ?? (() => { }),
        };
        this.#hotCache = new BoundedMap({
            maxSize: this.#config.hotCacheMaxSize,
            // A non-positive window is the documented way to turn the hot cache off, and
            // a `ttlMs` of 0 would expire every entry on the next read.
            ttlMs: hotRetentionMs > 0 ? hotRetentionMs : Number.POSITIVE_INFINITY,
        });
        this.#mirror =
            mirrorMaxSize > 0
                ? new BoundedMap({
                    maxSize: mirrorMaxSize,
                    // The mirror is bounded by count alone. A TTL would make a synchronous
                    // read answer differently depending on when it was asked.
                    ttlMs: Number.POSITIVE_INFINITY,
                    // Recency refresh is the hot cache's business; the mirror is a window
                    // over append order, so eviction must not depend on who read last.
                    eviction: 'fifo',
                    touchOnRead: false,
                    onEvict: config.mirror?.onEvict,
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
    append(input) {
        const validated = this.#config.schema.parse({ at: Date.now(), ...input });
        const seq = this.#hotSeq++;
        if (this.#config.hotRetentionMs > 0)
            this.#hotCache.set(seq, validated);
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
    records() {
        return this.#mirror?.toArray() ?? [];
    }
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
    recordsSince(seq) {
        const cursor = this.#hotSeq;
        if (!this.#mirror)
            return { entries: [], seq: cursor };
        const entries = [];
        for (const [key, entry] of this.#mirror.entries()) {
            if (key >= seq)
                entries.push(entry);
        }
        return { entries, seq: cursor };
    }
    /**
     * How many records the mirror holds.
     *
     * Not `records().length`: two callers ask this for a count on paths that run
     * per judgment and per command, and materializing a fifty-thousand-entry
     * window to throw it away is the query they were avoiding.
     */
    get size() {
        return this.#mirror?.size() ?? 0;
    }
    /** Replace the mirror with entries read back from disk, so a reload continues the window. */
    loadMirror(entries) {
        this.#mirror?.clear();
        for (const entry of entries)
            this.#mirror?.set(this.#hotSeq++, entry);
    }
    /**
     * Query entries with optional filters. The hot cache answers when it is
     * sufficient; otherwise disk is authoritative — every append is written
     * synchronously, so disk rows already contain the cached ones.
     */
    async query(filter = {}) {
        // Materializing the hot cache costs a full copy and a filter pass, so it is
        // deferred to the two cases that read it: a bounded query it can answer, and
        // the fallback when the ledger directory is unreadable. Both stop at the
        // limit — a bounded query over a full cache walked all ten thousand rows and
        // allocated every one of them to keep five.
        const cap = filter.limit ?? ALL_ROWS;
        let hotMatches;
        const cached = () => (hotMatches ??= collectUpTo(this.#hotCache.values(), cap, (e) => this.#matchesFilter(e, filter) ? e : undefined));
        if (filter.limit !== undefined) {
            const cacheMatches = cached();
            if (cacheMatches.length >= filter.limit)
                return cacheMatches;
        }
        const diskMatches = await this.#scanDisk(filter);
        if (diskMatches === null)
            return takeFirst(cached(), cap);
        return diskMatches;
    }
    /**
     * Append-order scan of the rollover files (oldest first, `limit` takes the
     * oldest rows). `null` means the ledger directory is unreadable — the caller
     * falls back to the hot cache.
     *
     * The filter and the cap both reach the file walk, so a bounded query parses
     * rows until it is full rather than validating every row of every file to keep
     * the first few. That is why the callback rejects a non-match instead of the
     * loop below skipping one: a reject is how the walk is told to stop asking.
     */
    async #scanDisk(filter) {
        const { limit } = filter;
        const cap = limit ?? ALL_ROWS;
        const matches = [];
        let files;
        try {
            files = await fs.readdir(this.#config.basePath);
        }
        catch {
            return null;
        }
        const { schema, onRead } = this.#config;
        for (const file of files.filter((f) => f.endsWith('.jsonl')).sort()) {
            if (matches.length >= cap)
                break;
            const { rows } = await readJsonlAsync(join(this.#config.basePath, file), (value) => {
                const parsed = schema.safeParse(value);
                return parsed.success && this.#matchesFilter(parsed.data, filter) ? parsed.data : null;
            }, cap - matches.length);
            for (const entry of rows) {
                await onRead(entry);
                matches.push(entry);
            }
        }
        return matches;
    }
    /** Rotate to a new file (daily rollover or cap reached). */
    rotate() {
        this.#currentFile = null;
        this.#currentEntries = 0;
        this.#rolloverIndex = 0;
        return;
    }
    /** Compact the ledger: dedupe by a key selector, rewrite files. */
    async compact(keySelector) {
        const all = await this.query({});
        const byKey = lastByKey(all, keySelector);
        // Rollover mode: rewrite all files
        await fs.rm(this.#config.basePath, { recursive: true, force: true }).catch(() => { });
        await ensureDir(this.#config.basePath);
        const date = utcDate();
        const fileName = this.#config.rollover.pathTemplate(date, 0);
        const targetFile = join(this.#config.basePath, fileName);
        await writeJsonl(targetFile, [...byKey.values()]);
        // Reset in-memory state to what the files now hold, so a compaction is
        // observable through `query` and through the synchronous mirror alike.
        this.#hotCache.clear();
        for (const entry of byKey.values())
            this.#hotCache.set(this.#hotSeq++, entry);
        this.#mirror?.clear();
        for (const entry of byKey.values())
            this.#mirror?.set(this.#hotSeq++, entry);
        this.#currentFile = targetFile;
        this.#currentDay = date;
        this.#currentEntries = byKey.size;
        this.#rolloverIndex = 0;
        return { kept: byKey.size, dropped: all.length - byKey.size };
    }
    /** Get the current file path. */
    getCurrentFile() {
        return this.#currentFile;
    }
    /** Get the base directory path. */
    getBasePath() {
        return this.#config.basePath;
    }
    /** Get hot cache size. */
    getHotCacheSize() {
        return this.#hotCache.size();
    }
    /** Release the in-memory views. Every entry is already durable on disk. */
    close() {
        this.#hotCache.clear();
        this.#mirror?.clear();
    }
    /** Clear all entries (in-memory views and files). */
    async clear() {
        this.#hotCache.clear();
        this.#mirror?.clear();
        // In rollover mode, we clear by removing all files in the basePath
        await fs.rm(this.#config.basePath, { recursive: true, force: true }).catch(() => { });
    }
    /** Invalidate hot cache (force next query to read from disk). */
    invalidateHotCache() {
        this.#hotCache.clear();
    }
    /** Run the retention sweep manually (deletes files older than retentionDays). */
    async runRetentionSweep() {
        await this.#pruneOldFiles();
    }
    // ─── Private ───
    #matchesFilter(entry, filter) {
        if (filter.correlationId && entry.correlationId !== filter.correlationId)
            return false;
        if (filter.sessionId && entry.sessionId !== filter.sessionId)
            return false;
        if (filter.since && entry.at < filter.since)
            return false;
        if (filter.until && entry.at > filter.until)
            return false;
        return true;
    }
    #writeToFile(entry) {
        const today = utcDate();
        // Daily rollover
        if (today !== this.#currentDay) {
            this.#currentDay = today;
            this.#rolloverIndex = 0;
            // Retention sweep piggybacked on daily rollover
            if (this.#config.rollover.retentionDays) {
                void this.#pruneOldFiles().catch(() => { });
            }
        }
        const fileName = this.#config.rollover.pathTemplate(this.#currentDay, this.#rolloverIndex);
        const targetFile = join(this.#config.basePath, fileName);
        if (this.#currentFile !== targetFile) {
            this.#currentFile = targetFile;
            this.#currentEntries = 0;
            // A basePath that exists as a file is a misconfiguration. Deleting it here
            // would turn a typo into silent data loss, so the write refuses instead.
            const { basePath } = this.#config;
            if (existsSync(basePath) && !statSync(basePath).isDirectory()) {
                throw new SenarsError(`Ledger basePath is not a directory: ${basePath}`, 'OPERATION_ERROR');
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
        }
        catch (error) {
            throw new SenarsError(`Ledger write failed: ${errMsg(error)}`, 'VALIDATION_ERROR');
        }
    }
    async #pruneOldFiles() {
        const { retentionDays } = this.#config.rollover;
        if (!retentionDays)
            return;
        const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        try {
            const files = await fs.readdir(this.#config.basePath);
            for (const file of files) {
                if (!file.endsWith('.jsonl'))
                    continue;
                const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})(?:-\d+)?\.jsonl/);
                if (!dateMatch)
                    continue;
                const dateStr = dateMatch[1];
                if (!dateStr)
                    continue;
                const fileDate = new Date(dateStr).getTime();
                if (fileDate < cutoff) {
                    await fs.unlink(join(this.#config.basePath, file)).catch(() => { });
                }
            }
        }
        catch {
            // Directory may not exist
        }
    }
}
/**
 * Convenience factory for common ledger shapes.
 */
export function createLedger(basePath, schema, options = {}) {
    return new Ledger({ basePath, schema, ...options });
}
