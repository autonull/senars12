import { containsFolded, foldNeedle } from '@senars/util/text';
import { flatUnique, getOrInsert, rankBy, takeLast } from '@senars/util/collections';
import { systemClock } from '@senars/util/clock';
import { cachePath } from '@senars/config';
import { EPISODE_TYPES } from '../types/episodic-memory';
import { sortableIdSource } from '@senars/util/id';
import { BaseLedgerEntrySchema, createLedger, DEFAULT_ROLLOVER, } from '@senars/util/ledger';
import { z } from 'zod';
import { CausalIndex } from './CausalIndex';
/**
 * Episode ids are ULIDs, not UUIDs: the causal timeline and the JSONL replay
 * scan them in mint order, and `tests/nar/refactor1-timeline.test.ts` pins the
 * format. A sortable id source, minted here rather than from the `ulid` package,
 * so `ulid` stays a leaf dependency of `util`.
 */
const episodeIds = sortableIdSource();
const DEFAULT_CONFIG = {
    enabled: true,
    basePath: cachePath('episodes'),
    retentionDays: DEFAULT_ROLLOVER.retentionDays,
    maxEntriesPerFile: DEFAULT_ROLLOVER.maxEntriesPerFile,
};
/**
 * Episode schema for Ledger-backed EpisodicMemory.
 * Exported for test reuse and external ledger construction.
 */
export const EpisodeSchema = BaseLedgerEntrySchema.extend({
    type: z.enum(EPISODE_TYPES),
    content: z.string(),
    metadata: z.record(z.string(), z.unknown()),
    id: z.string().optional(),
    causes: z.array(z.string()).optional(),
    consequences: z.array(z.string()).optional(),
    context: z.array(z.string()).optional(),
});
/** Ledger entry → in-memory episode projection (the `at` field is the timestamp). */
const toEpisode = (entry) => ({
    timestamp: entry.at,
    type: entry.type,
    content: entry.content,
    metadata: entry.metadata,
    id: entry.id,
    causes: entry.causes,
    consequences: entry.consequences,
    context: entry.context,
});
const matchesFilter = (e, options) => {
    const meta = e.metadata;
    if (options.correlationId && meta?.correlationId !== options.correlationId)
        return false;
    if (options.sessionId && meta?.sessionId !== options.sessionId)
        return false;
    if (options.type && e.type !== options.type)
        return false;
    if (options.timeRange) {
        const [start, end] = options.timeRange;
        if (e.timestamp < start || e.timestamp > end)
            return false;
    }
    if (options.causedBy && !(e.causes ?? []).includes(options.causedBy))
        return false;
    if (options.leadingTo && !(e.consequences ?? []).includes(options.leadingTo))
        return false;
    return true;
};
export class EpisodicMemory {
    #ledger;
    #config;
    #clock;
    /** Phase D: episodes dropped only if a rollover write itself fails. */
    static droppedTotal = 0;
    /** Phase D: lazy metadata index — sessionId/correlationId filters without O(all) scans. */
    #index = null;
    /** Phase A: lazy causal edge index — causedBy/leadingTo without O(all) scans. */
    #causal = null;
    /** Phase B: optional admit sink — invoked after each successful append (best-effort). */
    onLogged;
    constructor(config = {}) {
        const { clock, ...rest } = config;
        this.#config = { ...DEFAULT_CONFIG, ...rest };
        this.#clock = clock ?? systemClock;
        this.#ledger = createLedger(this.#config.basePath, EpisodeSchema, {
            rollover: {
                daily: true,
                maxEntriesPerFile: this.#config.maxEntriesPerFile,
                retentionDays: this.#config.retentionDays,
            },
            onWrite: (entry) => {
                if (this.onLogged) {
                    try {
                        this.onLogged(entry);
                    }
                    catch {
                        /* admit sink is best-effort; never fails the append */
                    }
                }
            },
        });
    }
    get basePath() {
        return this.#config.basePath;
    }
    async log(type, content, metadata = {}) {
        if (!this.#config.enabled)
            return;
        // Phase D: reserved causal keys lift onto the Episode; everything else stays in metadata.
        const { id: causalId, causes, consequences, context, ...meta } = metadata;
        const episode = {
            timestamp: this.#clock(),
            type,
            content,
            metadata: meta,
            id: typeof causalId === 'string' ? causalId : episodeIds(),
            ...(Array.isArray(causes) ? { causes: causes } : {}),
            ...(Array.isArray(consequences) ? { consequences: consequences } : {}),
            ...(Array.isArray(context) ? { context: context } : {}),
        };
        this.#index?.get(`cid:${meta.correlationId}`)?.push(episode);
        this.#index?.get(`sid:${meta.sessionId}`)?.push(episode);
        this.#causal?.add(episode);
        const ledgerEntry = {
            at: episode.timestamp,
            correlationId: meta.correlationId,
            sessionId: meta.sessionId,
            type: episode.type,
            content: episode.content,
            metadata: episode.metadata,
            id: episode.id,
            causes: episode.causes,
            consequences: episode.consequences,
            context: episode.context,
        };
        this.#ledger.append(ledgerEntry);
    }
    async getRecent(limit = 5) {
        return this.getEpisodes({ limit });
    }
    async search(query, limit = 10) {
        const episodes = await this.getEpisodes({ limit });
        const lower = foldNeedle(query);
        return episodes.filter((e) => containsFolded(e.content, lower) || containsFolded(JSON.stringify(e.metadata), lower));
    }
    async close() {
        this.#ledger.close();
    }
    // Internal methods (not part of the public interface)
    async getEpisodes(options) {
        if (options?.causedBy || options?.leadingTo) {
            const indexed = await this.#queryCausal(options);
            if (indexed)
                return indexed;
        }
        if (options?.sessionId || options?.correlationId) {
            const indexed = await this.#queryIndexed(options);
            if (indexed)
                return indexed;
        }
        return this.#scanEpisodes(options);
    }
    /**
     * One indexed query shape: build the index if it is missing, collect the
     * episode sets the filter's keys select, and resolve them.
     *
     * Both index paths differ only in which index they need and which keys they
     * read, so the failure policy — a build that throws falls back to the scan
     * rather than failing the query — is stated once here instead of once per
     * index, which is where the two copies could disagree about it.
     */
    async #queryViaIndex(options, index, build, select) {
        try {
            if (!index())
                await build();
        }
        catch {
            return null; // fall back to the scan path
        }
        // Read after the build: the field the getter names is what the build fills.
        const built = index();
        if (!built)
            return null;
        return this.#resolve(select(built, options), options);
    }
    /** Phase A: indexed causal path — O(matches) after a one-time index build. */
    #queryCausal(options) {
        return this.#queryViaIndex(options, () => this.#causal, () => this.#buildIndexes(), (causal, filter) => {
            const sources = [];
            if (filter.causedBy)
                sources.push(causal.causedBy(filter.causedBy));
            if (filter.leadingTo)
                sources.push(causal.leadingTo(filter.leadingTo));
            return sources;
        });
    }
    /** Phase D: indexed path — O(matches) after a one-time index build. */
    #queryIndexed(options) {
        return this.#queryViaIndex(options, () => this.#index, () => this.#buildIndexes(), (index, filter) => {
            const sources = [];
            if (filter.correlationId)
                sources.push(index.get(`cid:${filter.correlationId}`) ?? []);
            if (filter.sessionId)
                sources.push(index.get(`sid:${filter.sessionId}`) ?? []);
            return sources;
        });
    }
    /** Conjunction over the index keys a filter provided, then the shared tail. */
    #resolve(sources, options) {
        const candidates = sources.length === 1 ? sources[0] : flatUnique(sources);
        const matches = candidates.filter((e) => matchesFilter(e, options));
        return options.limit === undefined ? matches : takeLast(matches, options.limit);
    }
    /**
     * One-time pass over all files, filling both indexes: episodes bucketed by
     * sessionId/correlationId, and episodes bucketed by causal edge. They are built
     * from the same rows and the ledger read validates every one of them, so building
     * them on demand meant whichever query arrived second paid for a second full read
     * of the store.
     */
    async #buildIndexes() {
        const index = new Map();
        const causal = new CausalIndex();
        for (const entry of await this.#ledger.query({})) {
            const episode = toEpisode(entry);
            const meta = episode.metadata;
            if (typeof meta?.correlationId === 'string')
                getOrInsert(index, `cid:${meta.correlationId}`, () => []).push(episode);
            if (typeof meta?.sessionId === 'string')
                getOrInsert(index, `sid:${meta.sessionId}`, () => []).push(episode);
            causal.add(episode);
        }
        this.#index = index;
        this.#causal = causal;
    }
    /** Fallback scan via ledger query. */
    async #scanEpisodes(options) {
        const filter = {};
        if (options?.correlationId)
            filter.correlationId = options.correlationId;
        if (options?.sessionId)
            filter.sessionId = options.sessionId;
        if (options?.timeRange) {
            filter.since = options.timeRange[0];
            filter.until = options.timeRange[1];
        }
        if (options?.limit)
            filter.limit = options.limit;
        const entries = await this.#ledger.query(filter);
        const episodes = [];
        for (const entry of entries) {
            const episode = toEpisode(entry);
            if (!matchesFilter(episode, options ?? {}))
                continue;
            episodes.push(episode);
        }
        // Most recent first
        return rankBy(episodes, (episode) => episode.timestamp);
    }
    async pruneOldEpisodes() {
        await this.#ledger.runRetentionSweep();
    }
    async clear() {
        await this.#ledger.clear();
        this.#index = null;
        this.#causal = null;
    }
    async recallRecent(limit = 5) {
        return this.getEpisodes({ limit, type: 'input' });
    }
    async getRecentSummary(limit = 10) {
        const episodes = await this.getEpisodes({ limit });
        if (episodes.length === 0)
            return 'No recent episodes.';
        const recent = episodes.slice(0, 5);
        return recent
            .map((e) => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.type}: ${e.content}`)
            .join('\n');
    }
}
