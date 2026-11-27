/**
 * Fold-Derived Memory Views — materialized views of memory indexes derived from the event log.
 *
 * These replace the private stores of CausalIndex, ConceptGraph, Associative/EmbeddingLayer,
 * and EpisodeConsolidator with fold views that preserve every query surface.
 * Forgetting/archive → view eviction.
 */
import type { Term } from '../terms/index';
import type { Episode } from '@senars/types/episodic-memory';
import type { EpisodeCandidate, ConsolidationResult } from './episode-consolidator';
import type { CoActivationEdge } from './ConceptGraph';
import type { RecallHit } from './associative';
import type { IndexedEmbedding } from './links/EmbeddingLayer';
/** Base fold view interface. */
export interface FoldView<T> {
    /** View name. */
    name: string;
    /** Current version. */
    version: number;
    /** Last updated timestamp. */
    lastUpdated: number;
    /** Whether view is stale (needs refresh). */
    stale: boolean;
    /** Refresh the view from the log. */
    refresh(): Promise<void>;
    /** Evict the view (forgetting). */
    evict(): void;
    /** Get the view data. */
    getData(): T;
}
/** Causal index fold view. */
export interface CausalIndexView extends FoldView<CausalIndexData> {
    causedBy(id: string): Episode[];
    leadingTo(id: string): Episode[];
}
export interface CausalIndexData {
    byCauses: Map<string, Episode[]>;
    byConsequences: Map<string, Episode[]>;
}
/** Create a causal index fold view. */
export declare function createCausalIndexView(getLog: () => Episode[]): CausalIndexView;
/** Concept graph fold view. */
export interface ConceptGraphView extends FoldView<ConceptGraphData> {
    activate(term: Term, coActiveWith?: Term): void;
    getCoActivations(term: Term, limit?: number): CoActivationEdge[];
    getActivationCount(term: Term): number;
    decayAll(rate: number): void;
}
export interface ConceptGraphData {
    root: ConceptNodeView;
    nodeCount: number;
    edgeCount: number;
}
export interface ConceptNodeView {
    term: Term;
    children: Map<string, ConceptNodeView>;
    coActivations: Map<string, CoActivationEdge>;
    activationCount: number;
    lastActivated: number;
}
/** Create a concept graph fold view. */
export declare function createConceptGraphView(getLog: () => Episode[], options?: {
    maxNodes?: number;
    maxEdgesPerNode?: number;
    decayRate?: number;
    minEdgeWeight?: number;
}): ConceptGraphView;
/** Associative memory fold view. */
export interface AssociativeMemoryView extends FoldView<AssociativeMemoryData> {
    recall(term: Term, options?: {
        limit?: number;
        minStrength?: number;
    }): RecallHit[];
    associate(from: Term, to: Term, options?: {
        strength?: number;
    }): boolean;
}
export interface AssociativeMemoryData {
    links: Map<string, Map<string, {
        target: Term;
        strength: number;
        type?: string;
    }>>;
}
/** Create an associative memory fold view. */
export declare function createAssociativeMemoryView(getLog: () => Episode[]): AssociativeMemoryView;
/** Embedding layer fold view. */
export interface EmbeddingLayerView extends FoldView<EmbeddingLayerData> {
    indexConcept(term: Term): Promise<void>;
    findSimilarTerms(queryTerm: Term, topK?: number): Promise<Array<{
        term: Term;
        similarity: number;
    }>>;
    similarity(termA: Term, termB: Term): number;
}
export interface EmbeddingLayerData {
    embeddings: Map<string, IndexedEmbedding>;
    generator: any;
}
/** Create an embedding layer fold view. */
export declare function createEmbeddingLayerView(getLog: () => Episode[], generator: any): EmbeddingLayerView;
/** Episode consolidator fold view. */
export interface EpisodeConsolidatorView extends FoldView<EpisodeConsolidatorData> {
    consolidate(budget?: number): Promise<ConsolidationResult[]>;
    getCandidates(): EpisodeCandidate[];
}
export interface EpisodeConsolidatorData {
    candidates: EpisodeCandidate[];
    emittedSummaries: Episode[];
}
/** Create an episode consolidator fold view. */
export declare function createEpisodeConsolidatorView(getLog: () => Episode[]): EpisodeConsolidatorView;
/** Analyzer fold view base interface. */
export interface AnalyzerFoldView<T> extends FoldView<T> {
    /** Get analysis for a specific episode. */
    analyzeEpisode(episode: Episode): T;
    /** Get aggregated analysis across all episodes. */
    getAggregated(): T;
}
/** Generated analyzer view creators — one per definition. */
export interface CapabilitiesAnalyzerData {
    capabilityUsage: Map<string, number>;
    coverage: number;
}
export declare const createCapabilitiesAnalyzerView: (getLog: () => Episode[]) => AnalyzerFoldView<{
    capabilityUsage: Map<string, number>;
    coverage: number;
}>;
export interface ConstantsAnalyzerData {
    constantValues: Map<string, {
        value: unknown;
        count: number;
    }>;
}
export declare const createConstantsAnalyzerView: (getLog: () => Episode[]) => AnalyzerFoldView<{
    readonly constantValues: Map<string, {
        value: unknown;
        count: number;
    }>;
}>;
export interface CorrectionsAnalyzerData {
    corrections: Array<{
        from: string;
        to: string;
        confidence: number;
    }>;
}
export declare const createCorrectionsAnalyzerView: (getLog: () => Episode[]) => AnalyzerFoldView<{
    readonly corrections: Array<{
        from: string;
        to: string;
        confidence: number;
    }>;
}>;
export interface PerformanceAnalyzerData {
    metrics: Map<string, {
        mean: number;
        count: number;
    }>;
}
export declare const createPerformanceAnalyzerView: (getLog: () => Episode[]) => AnalyzerFoldView<{
    readonly metrics: Map<string, {
        mean: number;
        count: number;
    }>;
}>;
export interface QualityAnalyzerData {
    qualityScores: number[];
    meanQuality: number;
}
export declare const createQualityAnalyzerView: (getLog: () => Episode[]) => AnalyzerFoldView<{
    readonly qualityScores: number[];
    readonly meanQuality: 0;
}>;
export interface ReasoningPatternsAnalyzerData {
    patterns: Map<string, number>;
}
export declare const createReasoningPatternsAnalyzerView: (getLog: () => Episode[]) => AnalyzerFoldView<{
    readonly patterns: Map<string, number>;
}>;
export interface ResourcesAnalyzerData {
    resourceUsage: Map<string, {
        mean: number;
        peak: number;
        count: number;
    }>;
}
export declare const createResourcesAnalyzerView: (getLog: () => Episode[]) => AnalyzerFoldView<{
    readonly resourceUsage: Map<string, {
        mean: number;
        peak: number;
        count: number;
    }>;
}>;
export interface TermPatternsAnalyzerData {
    termFrequency: Map<string, number>;
    coOccurrence: Map<string, Map<string, number>>;
}
export declare const createTermPatternsAnalyzerView: (getLog: () => Episode[]) => AnalyzerFoldView<{
    readonly termFrequency: Map<string, number>;
    readonly coOccurrence: Map<string, Map<string, number>>;
}>;
/** Registry of all fold views using KeyedRegistry. */
import { KeyedRegistry } from '../util/keyed-collection';
/** Registry of all fold views using KeyedRegistry. */
export declare class FoldViewRegistry {
    readonly views: KeyedRegistry<FoldView<any>>;
    constructor();
    /** Register a fold view. */
    register(view: FoldView<any>): void;
    /** Get a fold view by name. */
    get(name: string): FoldView<any> | undefined;
    /** Get all registered view names. */
    getNames(): string[];
    /** Get all registered views. */
    getAll(): FoldView<any>[];
    /** Refresh all views. */
    refreshAll(): Promise<void>;
    /** Evict all views (forgetting). */
    evictAll(): void;
    /** Clear all registrations. */
    clear(): void;
}
export declare function createFoldViewRegistry(getLog: () => Episode[], embeddingGenerator: any): FoldViewRegistry;
/** Refresh all views. */
export declare function refreshAllViews(registry: FoldViewRegistry): Promise<void>;
/** Evict all views (forgetting). */
export declare function evictAllViews(registry: FoldViewRegistry): void;
//# sourceMappingURL=fold-views.d.ts.map