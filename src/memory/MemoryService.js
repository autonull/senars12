import { BoundedRing, takeLast } from '@senars/util/collections';
import { generateId } from '@senars/util/id';
import { sweepEngines } from '../engine/sweep';
import { RECALL_WINDOW, WORKING_MEMORY_CAPACITY } from './types';
export class MemoryService {
    /**
     * The working tier is a bounded ring, like every other bounded structure in the
     * kernel, so it reports `pressure()` and evicts by the same rule rather than by
     * a bare `pushCapped` against a private `#maxWorking`.
     */
    #working = new BoundedRing(WORKING_MEMORY_CAPACITY);
    #log;
    #engines;
    #motor;
    #tiers = new Map();
    get size() {
        return this.#working.size();
    }
    get all() {
        return this.#working.toArray();
    }
    /** Occupancy of the working tier, `0..1` — the AIKR pressure signal. */
    pressure() {
        return this.#working.pressure();
    }
    get connectedEngines() {
        return this.#engines;
    }
    /** Resize the working tier, keeping the most recent entries that still fit. */
    setMaxWorking(max) {
        const kept = this.#working.tail(max);
        this.#working = new BoundedRing(Math.max(1, max));
        for (const entry of kept)
            this.#working.push(entry);
    }
    /** Connect the EventLog for Tier 1 (episodic) queries */
    connectLog(log) {
        this.#log = log;
    }
    /** Connect engines for Tier 2 (semantic) queries */
    connectEngines(engines) {
        this.#engines = engines;
    }
    /** Connect ToolRegistry for Tier 3 (procedural) feedback */
    connectMotor(motor) {
        this.#motor = motor;
    }
    append(entry) {
        const full = {
            ...entry,
            id: generateId('mem'),
            timestamp: Date.now(),
        };
        this.#working.push(full);
    }
    recent(limit, type) {
        return type
            ? takeLast(this.#working.filter((e) => e.type === type), limit)
            : this.#working.tail(limit);
    }
    query(q) {
        const { type, from, to, limit } = q;
        const inRange = (e) => (!type || e.type === type) &&
            (from === undefined || e.timestamp >= from) &&
            (to === undefined || e.timestamp <= to);
        const matched = this.#working.filter(inRange);
        return takeLast(matched, limit ?? matched.length);
    }
    queryTimeRange(from, to) {
        return this.#working.filter((e) => e.timestamp >= from && e.timestamp <= to);
    }
    queryAroundTime(ts, windowMs) {
        return this.#working.filter((e) => Math.abs(e.timestamp - ts) <= windowMs);
    }
    /** Tier 1: Episodic memory via the log's own filtered read. */
    async queryEpisodic(from, to, types, limit = RECALL_WINDOW) {
        if (!this.#log)
            return [];
        try {
            // `timestamp` is a positive integer (see `CognitiveEventBaseSchema`), so the
            // open ends of a half-given range are 0 and `MAX_SAFE_INTEGER` — a range
            // the store can filter on, rather than a predicate that drops back to a
            // full-log read in JavaScript.
            const events = await this.#log.query({
                types,
                timeRange: from === undefined && to === undefined
                    ? undefined
                    : [from ?? 0, to ?? Number.MAX_SAFE_INTEGER],
                limit,
            });
            return events.map((e) => ({
                id: e.id ?? `event-${e.timestamp}`,
                type: e.type,
                payload: e.payload,
                timestamp: e.timestamp,
                correlationId: e.correlationId,
            }));
        }
        catch {
            return [];
        }
    }
    /** Tier 2: Semantic memory via engines */
    async querySemantic(pattern) {
        const results = await sweepEngines(this.#engines, (engine) => engine.query(pattern));
        return results.flat();
    }
    /** Tier 3: Procedural memory — tool feedback */
    getProceduralFeedback() {
        return this.#motor?.getAllFeedback() ?? [];
    }
    /** Tier 4: Long-term persistence */
    async persist() {
        await sweepEngines(this.#engines, (engine) => engine.persist?.());
    }
    async load() {
        await sweepEngines(this.#engines, (engine) => engine.load?.());
    }
    /** Register an additional memory tier (e.g. vector store via plugin). */
    addTier(name, impl) {
        this.#tiers.set(name, impl);
    }
    getTier(name) {
        return this.#tiers.get(name);
    }
    /** Consolidate: promote high-salience entries to semantic via engines */
    async consolidate(_correlationId) {
        // Future: promote successful patterns, high-confidence derivations
    }
    clear() {
        this.#working.clear();
    }
}
