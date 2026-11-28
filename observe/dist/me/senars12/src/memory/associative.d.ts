/**
 * Associative memory — the one shape every "what relates to this term?" index
 * presents to the strategy layer.
 *
 * Term links, embedding similarity and co-activation graphs are the same
 * operation with different storage. Giving them a single synchronous port
 * means premise strategies, sources and scorers no longer special-case each
 * one, and a new index is registered rather than wired in.
 *
 * Leaf module: no imports from the strategy layer, so `strategies/ → memory/`
 * stays a one-way acyclic edge (same rule as `view.ts`).
 */
import type { ConceptGraph } from './ConceptGraph';
import type { Layer } from './links/Layer';
import type { LinkType } from './links/types';
import type { Term } from '../terms/index';
/** Name of the co-activation graph memory. */
export declare const GRAPH_MEMORY = "graph";
export interface RecallHit {
    readonly term: Term;
    /** Association strength in [0, 1]; comparable across memories for ranking. */
    readonly strength: number;
}
export interface RecallOptions {
    limit?: number;
    minStrength?: number;
}
export interface AssociateOptions {
    /** Link strength in [0, 1]; defaults to the layer's default priority. */
    strength?: number;
    type?: LinkType;
}
export interface AssociativeMemory {
    readonly name: string;
    /** Terms associated with `term`, strongest first. Empty when the term is unknown. */
    recall(term: Term, options?: RecallOptions): RecallHit[];
    /**
     * Optional write verb. A read-through view legitimately cannot write, so its
     * absence is a valid implementation rather than a special case (TODO27 D6).
     */
    associate?(from: Term, to: Term, options?: AssociateOptions): boolean;
}
/**
 * Associative memory over a link layer: term links, or semantic embedding links.
 *
 * The layer is resolved per recall rather than captured, so the memory stays
 * correct when the layer behind its name is replaced or created on demand.
 */
export declare class LinkLayerMemory implements AssociativeMemory {
    readonly name: string;
    private readonly layer;
    constructor(name: string, layer: () => Layer | undefined);
    recall(term: Term, { limit, minStrength }?: RecallOptions): RecallHit[];
    associate(from: Term, to: Term, { strength, type }?: AssociateOptions): boolean;
}
/** Associative memory over the bounded co-activation graph. */
export declare class GraphMemory implements AssociativeMemory {
    private readonly graph;
    private readonly limit;
    readonly name = "graph";
    constructor(graph: ConceptGraph, limit?: number);
    recall(term: Term, { limit, minStrength }?: RecallOptions): RecallHit[];
}
/** Resolves a link layer by name; every layer the manager owns is a memory. */
export type LinkLayerResolver = (name: string) => Layer | undefined;
/**
 * Name → memory registry.
 *
 * Explicitly registered memories win; any other name is resolved as a link
 * layer, so a layer added to the `LinkManager` is immediately recallable
 * without a second registration step. An unresolvable name recalls as empty
 * rather than throwing: which associative memories exist is a deployment
 * choice, and a premise strategy must degrade, not fail.
 */
export declare class AssociativeRegistry {
    private readonly layers?;
    private readonly memories;
    constructor(layers?: LinkLayerResolver | undefined);
    register(memory: AssociativeMemory): this;
    get(name: string): AssociativeMemory | undefined;
    names(): string[];
    recall(name: string, term: Term, options?: RecallOptions): RecallHit[];
    /** Record an association; `false` when the memory behind the name cannot write. */
    associate(name: string, from: Term, to: Term, options?: AssociateOptions): boolean;
}
//# sourceMappingURL=associative.d.ts.map