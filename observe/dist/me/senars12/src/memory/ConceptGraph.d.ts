/**
 * ConceptGraph — Trie-structured co-activation edges for RuleGraph.
 * Provides O(k) lookup where k = term depth, with fallback edges for non-regression.
 */
import { type Clock } from '@senars/util/clock';
import type { Term } from '../terms/index';
export interface CoActivationEdge {
    targetTerm: Term;
    weight: number;
    evidenceCount: number;
    lastUpdated: number;
}
export declare const one: () => number;
export interface ConceptGraphOptions {
    maxNodes?: number;
    maxEdgesPerNode?: number;
    decayRate?: number;
    minEdgeWeight?: number;
    /** Injected clock for `lastActivated`/`lastUpdated` (default `systemClock`). */
    clock?: Clock;
}
export declare class ConceptGraph {
    private root;
    private readonly maxNodes;
    private readonly maxEdgesPerNode;
    private readonly decayRate;
    private readonly minEdgeWeight;
    private readonly now;
    private nodeCount;
    private edgeCount;
    constructor(options?: ConceptGraphOptions);
    private createNode;
    /** Per-node edge budget: weakest edge loses the slot, and `edgeCount` follows. */
    private createEdgeBag;
    private traversePath;
    /** Activate a concept and optionally record co-activation with another concept. */
    activate(term: Term, coActiveWith?: Term): void;
    /** Get co-activation edges for a concept, sorted by weight descending. */
    getCoActivations(term: Term, limit?: number): CoActivationEdge[];
    /** Get fallback edges — high-level structural connections for non-regression. */
    getFallbackEdges(term: Term): Term[];
    /** Decay all edge weights and prune weak edges. */
    decay(): void;
    /** Get graph statistics. */
    getStats(): {
        nodes: number;
        edges: number;
        maxNodes: number;
    };
    /** Serialize for persistence. */
    serialize(): SerializedConceptGraph;
    private serializeNode;
    /** Deserialize from persistence. An injected clock must be re-supplied by the caller. */
    static deserialize(data: SerializedConceptGraph, options?: {
        clock?: Clock;
    }): ConceptGraph;
    private deserializeNode;
    private count;
}
export interface SerializedConceptGraph {
    nodes: SerializedConceptNode;
    maxNodes: number;
    maxEdgesPerNode: number;
    decayRate: number;
    minEdgeWeight: number;
}
interface SerializedConceptNode {
    term: Term;
    activationCount: number;
    lastActivated: number;
    children: Array<[string, SerializedConceptNode]>;
    coActivations: Array<[
        string,
        {
            targetTerm: Term;
            weight: number;
            evidenceCount: number;
            lastUpdated: number;
        }
    ]>;
}
export {};
//# sourceMappingURL=ConceptGraph.d.ts.map