import type { Concept } from './concept';
/** Every family defaults on; a caller opts out of the ones it does not maintain. */
export interface MemoryIndexConfig {
    /** Concepts whose whole term is that atom, keyed by `atomKey`. */
    enableAtomicIndex?: boolean;
    /** Concepts bucketed by the second they were admitted. */
    enableTemporalIndex?: boolean;
}
/**
 * Two lookup families over the concept store, and nothing else.
 *
 * This held five. Three of them — an activation snapshot, a recursive subterm
 * index and a similarity cluster map — were maintained on every admission and
 * torn down on every removal, and **no production caller ever read any of them**:
 * the activation value was a copy of `concept.priority` taken once at admission,
 * so it went stale the moment anything touched the concept; and the cluster map
 * held one cluster per distinct term, which made `indexedConcepts()` yield the
 * entire store — a full walk wearing an index's name, plus a sorted insert and a
 * footprint object per admission to keep it in step. Similarity retrieval reads
 * the store now, which is what it was doing behind the index anyway.
 *
 * So what remains are the two families whose reads reach a port
 * (`queryBySymbol`, `queryByTimeRange`), and each doc comment says what it can
 * actually find. An index that cannot narrow a search is a cost with no ceiling.
 */
export declare class MemoryIndex {
    private readonly atomicIndex;
    private readonly temporalIndex;
    /**
     * Only the bucket a concept was filed in, because unlike the atomic key it is
     * not derivable from the term — it came from an admission timestamp nothing
     * else records. One number per concept, where the five families needed an
     * object holding a key, an entry reference and two arrays.
     */
    private readonly temporalKeys;
    private config;
    private readonly temporalResolution;
    constructor(config?: MemoryIndexConfig);
    get stats(): {
        atomic: number;
        temporal: number;
    };
    index(concept: Concept, timestamp?: number): void;
    /**
     * Concepts whose *whole* term is `symbol`.
     *
     * A compound term keys as `kind:a,b`, so it is filed here under a key no caller
     * can spell — a compound is findable by its parts, not by a symbol it merely
     * mentions.
     */
    getByAtomic(symbol: string): Concept[];
    getByTemporal(timeRange: [number, number]): Concept[];
    /** Both keys are cheap reads — `termKey` is memoized on the term — so removal never scans. */
    remove(concept: Concept): void;
    clear(): void;
}
//# sourceMappingURL=memory-index.d.ts.map