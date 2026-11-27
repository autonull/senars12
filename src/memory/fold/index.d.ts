/**
 * Fold Memory — pure projections over the episodic log.
 *
 * The episodic log is the single source of truth; this class provides
 * the same public API but as read-only projections with mutations
 * becoming log appends (fire-and-forget).
 *
 * Projections:
 * - semantic: resident concepts derived from belief_added/revision episodes
 * - procedural: task bags derived from task admission episodes
 * - episodic: log replay and link/revision/archive projections
 */
import { type RandomSource } from '@senars/util/random';
import type { AttentionModel } from '../../strategies/types';
import { Stamp, type Term } from '../../terms';
import type { Budget, Task } from '../../types';
import type { ConceptGraph } from '../ConceptGraph';
import { Concept, type ConceptTaskType, type TaskData } from '../concept';
import { type MemoryConfig, type ResolvedMemoryConfig } from '../config';
import { Focus } from '../focus';
import type { MemoryHealth } from '../health';
import { LinkManager } from '../links/LinkManager';
import type { MemoryPorts, LinkPort, MemoryStatistics, StorePressure } from '../ports/index';
import type { EvictionReport } from '../pressure';
import { EpisodicMemory } from '../EpisodicMemory';
import type { Belief, Question, MemoryStats } from '../view';
/** Fold Memory — pure projections over the episodic log. */
export declare class FoldMemory implements MemoryPorts {
    #private;
    /** D17: bounded revision log capacity. */
    static readonly REVISION_LOG_CAP = 1000;
    constructor(log: EpisodicMemory, config?: MemoryConfig, options?: {
        attentionModel?: AttentionModel;
        clock?: () => number;
    });
    get attentionModel(): AttentionModel;
    setAttentionModel(model: AttentionModel): void;
    /** Current number of resident (non-archived) concepts. */
    get size(): number;
    listConcepts(): Concept[];
    conceptValues(): IterableIterator<Concept>;
    getConcept(term: Term): Concept | undefined;
    addConcept(term: Term): Concept;
    removeConcept(term: Term): boolean;
    archiveConcept(concept: Concept): boolean;
    clear(): void;
    addTask(term: Term, type: ConceptTaskType, truth?: any, budget?: Budget, stamp?: Stamp): boolean;
    beliefs(concept: Concept): TaskData[];
    taskCount(concept: Concept): number;
    getGoals(): Task[];
    getBeliefs(): Belief[];
    getQuestions(): Question[];
    stats(): MemoryStats;
    capacityPressure(): number;
    pressureBreakdown(): StorePressure;
    totals(): {
        totalConcepts: number;
        totalTasks: number;
    };
    getStatistics(): MemoryStatistics;
    queryBySymbol(symbol: string): Concept[];
    queryByTimeRange(start: number, end: number): Concept[];
    findConcepts(pattern: string, limit?: number): Concept[];
    findSimilarConcepts(term: Term, limit?: number): Concept[];
    getRelatedConcepts(term: Term, limit?: number): Concept[];
    links(): LinkPort;
    attachConceptGraph(graph: ConceptGraph): ConceptGraph;
    getLinks(sourceTerm: Term, options?: {
        layer?: string;
        type?: string;
        minPriority?: number;
        maxResults?: number;
    }): any[];
    getLinkPriority(sourceTerm: Term, targetTerm: Term, layerName?: string): number;
    addLink(sourceTerm: Term, targetTerm: Term, options?: {
        layer?: string;
        type?: string;
        priority?: number;
    }): any;
    removeByTerm(sourceTerm: Term, targetTerm: Term, type?: string): boolean;
    removeAllLinksForTerm(term: Term): void;
    getLayer(name: string): any;
    setLayer(name: string, layer: any): void;
    applyDecay(decayRate?: number): void;
    consolidate(opts?: {
        cycleCount?: number;
    }): void;
    topConcepts(limit: number): Concept[];
    sampleWindow(windowSize: number, rng: RandomSource): Concept[];
    getEmbeddingIndex(): any;
    getAssociativeMemories(): any;
    getLinkManager(): LinkManager;
    getFocusConcepts(): Concept[];
    getFocus(): Focus;
    getConfig(): ResolvedMemoryConfig;
    getMemoryPressure(): number;
    getRevisionHistory(term: Term): any[];
    findDenseClusters(minStrength: number, maxClusters: number): Concept[][];
    removeConceptsMatching(pattern: string): number;
    checkHealth(): MemoryHealth;
    compact(): void;
    evictionReport(): EvictionReport | undefined;
}
/** Create a FoldMemory instance. */
export declare function createFoldMemory(log: EpisodicMemory, config?: MemoryConfig, options?: {
    attentionModel?: AttentionModel;
    clock?: () => number;
}): FoldMemory;
//# sourceMappingURL=index.d.ts.map