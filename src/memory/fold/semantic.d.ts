/**
 * Semantic Fold — concept management and semantic memory operations.
 */
import { type Term } from '../../terms';
import { Concept } from '../concept';
import type { ConceptProjection } from './episodic';
import { Focus } from '../focus';
import { Archive } from '../lifecycle';
import { MemoryIndex } from '../memory-index';
import type { ResolvedMemoryConfig } from '../config';
import { LinkManager } from '../links/LinkManager';
import type { AttentionModel } from '../../strategies/types';
import type { EmbeddingGenerator } from '../embedding';
/** Semantic view over concepts. */
export declare class SemanticFold {
    #private;
    constructor(concepts: Map<string, ConceptProjection>, config: ResolvedMemoryConfig & {
        embeddingGenerator?: EmbeddingGenerator;
    }, options?: {
        attentionModel?: AttentionModel;
        clock?: () => number;
    });
    /** Current number of resident (non-archived) concepts. */
    get size(): number;
    /** List all resident concepts. */
    listConcepts(): Concept[];
    /** Iterate over resident concepts. */
    conceptValues(): IterableIterator<Concept>;
    /** Get a concept by term. */
    getConcept(term: Term): Concept | undefined;
    /** Add a concept. */
    addConcept(term: Term): Concept;
    /** Remove a concept. */
    removeConcept(term: Term): boolean;
    /** Archive a concept. */
    archiveConcept(concept: Concept): boolean;
    /** Clear all concepts. */
    clear(): void;
    /** Get focus concepts. */
    getFocusConcepts(): Concept[];
    /** Get focus instance. */
    getFocus(): Focus;
    /** Get archive instance. */
    getArchive(): Archive;
    /** Get link manager. */
    getLinkManager(): LinkManager;
    /** Get memory index. */
    getIndex(): MemoryIndex;
    /** Query concepts by atomic symbol. */
    queryBySymbol(symbol: string): Concept[];
    /** Query concepts by time range. */
    queryByTimeRange(start: number, end: number): Concept[];
    /** Find concepts matching pattern. */
    findConcepts(pattern: string, limit?: number): Concept[];
    /** Find similar concepts. */
    findSimilarConcepts(term: Term, limit?: number): Concept[];
    /** Get related concepts via links. */
    getRelatedConcepts(term: Term, limit?: number): Concept[];
    /** Get top concepts by priority. */
    topConcepts(limit: number): Concept[];
    /** Sample a window of concepts. */
    sampleWindow(windowSize: number, rng: RandomSource): Concept[];
    /** Check health. */
    checkHealth(): MemoryHealth;
    /** Compact memory. */
    compact(): void;
    /** Get capacity pressure. */
    capacityPressure(): number;
    /** Get totals. */
    totals(): {
        totalConcepts: number;
        totalTasks: number;
    };
    /** Get statistics. */
    getStatistics(): MemoryStatistics;
    /** Get pressure breakdown. */
    pressureBreakdown(): StorePressure;
    /** Get revision history for a term. */
    getRevisionHistory(_term: Term): any[];
    /** Find dense clusters. */
    findDenseClusters(_minStrength: number, _maxClusters: number): Concept[][];
    /** Remove concepts matching pattern. */
    removeConceptsMatching(pattern: string): number;
    /** Get embedding index. */
    getEmbeddingIndex(): EmbeddingLayer | undefined;
    /** Get associative memories. */
    getAssociativeMemories(): null;
}
import { type RandomSource } from '@senars/util/random';
import { EmbeddingLayer } from '../links/EmbeddingLayer';
import type { MemoryStatistics, StorePressure, MemoryHealth } from '../ports/index';
//# sourceMappingURL=semantic.d.ts.map