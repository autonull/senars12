import { type BeliefTruth } from '@senars/types/truth';
import { type RandomSource } from '@senars/util/random';
import type { AttentionModel } from '../strategies/types';
import { Stamp, type Term, Truth } from '../terms';
import type { Budget, Task } from '../types';
import { AssociativeRegistry } from './associative';
import type { ConceptGraph } from './ConceptGraph';
import { Concept, type ConceptMergeResult, type ConceptTaskType, type TaskData } from './concept';
import { type MemoryConfig } from './config';
import { Focus } from './focus';
import type { MemoryHealth } from './health';
import { LinkManager } from './links/LinkManager';
import { EmbeddingLayer } from './links/EmbeddingLayer';
import type { MemoryPorts, LinkPort, MemoryStatistics, StorePressure } from './ports/index';
import type { EvictionReport } from './pressure';
import type { Belief, Question } from './view';
export interface RevisionEntry {
    /**
     * `termKey` of the revised term. The log is keyed, never rendered: nothing
     * reads this as text, so it carries the canonical structural identity rather
     * than a serialized form that two distinct terms can share.
     */
    termKey: string;
    truth: BeliefTruth;
    stampId: string;
    timestamp: number;
    source: 'input' | 'derivation' | 'revision' | 'inference';
}
export declare class Memory implements MemoryPorts {
    #private;
    /** D17: bounded revision log capacity. */
    static readonly REVISION_LOG_CAP = 1000;
    private readonly concepts;
    private readonly associative;
    private readonly config;
    private readonly index;
    private readonly focus;
    private readonly archive;
    private readonly forgetting;
    private readonly linkManager;
    private readonly revisionLog;
    private lastRevisionTs;
    private cyclesSinceConsolidation;
    /** The last eviction pass's report, including whether it could free anything. */
    private lastEviction;
    constructor(config?: MemoryConfig, options?: {
        attentionModel?: AttentionModel;
    });
    getEmbeddingIndex(): EmbeddingLayer | undefined;
    getAssociativeMemories(): AssociativeRegistry;
    /** Publish the co-activation graph as the `graph` associative memory, replacing any prior one. */
    attachConceptGraph(graph: ConceptGraph): ConceptGraph;
    get size(): number;
    getConcept(term: Term): Concept | undefined;
    getLinkManager(): LinkManager;
    /** The link surface as a port, for consumers that need recall and nothing else. */
    links(): LinkPort;
    beliefs(concept: Concept): TaskData[];
    taskCount(concept: Concept): number;
    /**
     * The `attention` slot's live instance. Reading it is how the strategy layer
     * primes and decays; replacing it is how a reconfigure takes effect, which is
     * why it is a pair of accessors rather than a readonly field.
     */
    get attentionModel(): AttentionModel;
    setAttentionModel(model: AttentionModel): void;
    listConcepts(): Concept[];
    conceptValues(): IterableIterator<Concept>;
    forEachConcept(fn: (concept: Concept) => void): void;
    /**
     * The concept collection's entries, for a full sweep.
     *
     * Read straight off the entries rather than through `values()`: the term
     * collection's iterator is a general-purpose one that calls a projection
     * closure per element, and three full sweeps per inference cycle — decay,
     * sampling, relevance propagation — turned that into two indirect calls for
     * every resident concept, every cycle. An index and a field read is the floor
     * for a sweep. The array is live, so a sweep may not add or remove concepts;
     * the sweeps in this class only ever mutate the concepts themselves.
     */
    private residentEntries;
    getFocusConcepts(): Concept[];
    getFocus(): Focus;
    /**
     * A pure read: the stored goals, as tasks.
     *
     * It used to mint `Stamp.createInput()` for any goal admitted without one,
     * so a second call returned a different stamp for the same goal and
     * `Stamp.overlaps` / `noStampOverlap` reasoned about an id that could never
     * repeat. Stamps are minted once at admission (`Concept.addTask`) and read
     * here, which makes two reads of one goal return the same identity
     * (TODO29.a §4 row 5).
     */
    getGoals(): Task[];
    /**
     * A pure read: the stored beliefs, as tasks.
     */
    getBeliefs(): Belief[];
    /**
     * A pure read: the stored questions, as tasks.
     */
    getQuestions(): Question[];
    /** Iterator over all beliefs without allocating an array. */
    beliefTasks(): IterableIterator<Belief>;
    /** Iterator over all goals without allocating an array. */
    goalTasks(): IterableIterator<Task>;
    /** Iterator over all questions without allocating an array. */
    questionTasks(): IterableIterator<Question>;
    /**
     * Memory statistics.
     */
    stats(): MemoryStatistics;
    getConfig(): MemoryConfig;
    getMemoryPressure(): number;
    getRelatedConcepts(term: Term, limit?: number): Concept[];
    findConcepts(pattern: string, limit?: number): Concept[];
    addConcept(term: Term): Concept;
    /**
     * Make `concept` the live instance for its term. Adopting the instance rather
     * than rebuilding one is what lets an archived concept be restored with the
     * identity its links, tasks and revision history refer to.
     */
    private adoptConcept;
    addTask(term: Term, type: ConceptTaskType, truth?: Truth, budget?: Budget, stamp?: Stamp): boolean;
    getRevisionHistory(term: Term): RevisionEntry[];
    removeConcept(term: Term): boolean;
    /**
     * The `n` highest-attention resident concepts: attention order, which is what
     * `topK` means to every consumer.
     *
     * This used to rank by `MemoryScorer.scoreForRetrieval`, a four-factor score
     * whose novelty and relevance had no signals at any call site and whose
     * recency was a literal `1` — so the score was a constant plus a scaled
     * priority, and the ranking was attention order wearing an indirection. What
     * replaced it is deliberately free of the clock: a ranking that read
     * `lastAccessedAt` would make two stores built in the same millisecond order
     * differently, which is the determinism invariant the scorer cannot have
     * (TODO29.a §4 row 3, §5.4).
     */
    topConcepts(n: number): Concept[];
    /**
     * A random contiguous window of the priority-sorted store — the windowed-roulette
     * strategy's positional-local diversity.
     *
     * The window is taken from the whole sorted store rather than from `topConcepts`,
     * which returns *at most* `windowSize` concepts and so made the window the whole
     * result: the start offset was computed from an array that could not be longer
     * than the window, and the strategy's defining property never fired.
     */
    sampleWindow(windowSize: number, rng: RandomSource): Concept[];
    consolidate(opts?: {
        cycleCount?: number;
    }): void;
    findDenseClusters(minSize?: number, minLinkStrength?: number): Array<{
        concepts: Concept[];
        hasAbstract: boolean;
    }>;
    createAbstractConcept(name: string, sourceConcepts: Concept[]): Concept;
    removeConceptsMatching(pattern: string): number;
    /**
     * Archive a concept out of the live store. The store removal is the point:
     * an archive that leaves the concept resident does not relieve
     * `capacityPressure()`, so eviction runs again every cycle against a
     * population it has already shed, and `retrieveFromArchive` returns a concept
     * that is simultaneously archived and live.
     */
    archiveConcept(concept: Concept): boolean;
    clear(): void;
    /**
     * Pressure in `0..1`, the maximum of the store's own bounds rather than the
     * concept count alone (TODO29.a §5.8). {@link storePressure} owns the
     * derivation, so the eviction policy, the health report and the statistics
     * block cannot each read a different number for the same store.
     */
    capacityPressure(): number;
    /** The two bounds behind {@link capacityPressure}, so a report names both. */
    pressureBreakdown(): StorePressure;
    /** Totals without the tercile pass; what persistence serializes. */
    totals(): {
        totalConcepts: number;
        totalTasks: number;
    };
    getStatistics(): MemoryStatistics;
    setConfig(updates: Partial<MemoryConfig>): void;
    retrieveFromArchive(term: Term): Concept | undefined;
    queryBySymbol(symbol: string): Concept[];
    queryByTimeRange(start: number, end: number): Concept[];
    checkHealth(): MemoryHealth;
    compact(): void;
    mergeConcepts(concepts: Concept[]): ConceptMergeResult | null;
    /**
     * The `limit` concepts most similar to `term`, ranked by `selectSimilar`.
     *
     * The candidate set is the whole store, as it has always been: the similarity
     * clusters this used to read were one cluster per distinct term, so
     * "searching the index" was walking every concept and scoring it. Nothing here
     * can narrow the search, so nothing here pretends to.
     */
    findSimilarConcepts(term: Term, limit?: number): Concept[];
    private recordRevision;
    /**
     * The one decay sweep in the system, reached from {@link consolidate} and
     * nowhere else — so what a concept forgets is a function of elapsed
     * consolidation intervals rather than of how many times a sampler read the
     * store (TODO29.a §5.4). A concept already at zero stays there: its decay is
     * zero times the rate, so skipping it changes no value and saves the write.
     * Under pressure the tail of drained concepts is the majority of the
     * population.
     */
    private decayAll;
    private bfsCluster;
    private applyForgetting;
    private updateFocus;
    private updateAllFocus;
    private computeHealth;
    /**
     * What the last eviction pass did. A pass that freed nothing reports
     * `reason: 'exhausted'` — a store at capacity whose policy provably could not
     * act is a condition an operator has to be able to see, and returning
     * `{ archived: 0, forgotten: 0 }` made it indistinguishable from a pass that
     * found nothing wrong (TODO29.a §5.8).
     */
    evictionReport(): EvictionReport | undefined;
    /** Resident concepts holding at least one link to a term that is no longer stored. */
    private findOrphanedLinks;
}
export { deserialize, repair, type SerializedMemory, serialize, validate, } from './state/serialization';
//# sourceMappingURL=memory.d.ts.map