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
import { getOrInsert } from '@senars/util/collections';
/** Name of the co-activation graph memory. */
export const GRAPH_MEMORY = 'graph';
/**
 * Associative memory over a link layer: term links, or semantic embedding links.
 *
 * The layer is resolved per recall rather than captured, so the memory stays
 * correct when the layer behind its name is replaced or created on demand.
 */
export class LinkLayerMemory {
    name;
    layer;
    constructor(name, layer) {
        this.name = name;
        this.layer = layer;
    }
    recall(term, { limit = 10, minStrength = 0 } = {}) {
        return (this.layer()?.getLinksByTerm(term, { minPriority: minStrength, maxResults: limit }) ?? []).map((link) => ({ term: link.targetTerm, strength: link.priority }));
    }
    associate(from, to, { strength, type } = {}) {
        const layer = this.layer();
        if (!layer)
            return false;
        return layer.addLink({ sourceTerm: from, targetTerm: to, priority: strength, type }) !== null;
    }
}
/** Associative memory over the bounded co-activation graph. */
export class GraphMemory {
    graph;
    limit;
    name = GRAPH_MEMORY;
    constructor(graph, limit = 20) {
        this.graph = graph;
        this.limit = limit;
    }
    recall(term, { limit, minStrength = 0 } = {}) {
        return this.graph
            .getCoActivations(term, limit ?? this.limit)
            .filter((edge) => edge.weight >= minStrength)
            .map((edge) => ({ term: edge.targetTerm, strength: edge.weight }));
    }
}
/**
 * Name → memory registry.
 *
 * Explicitly registered memories win; any other name is resolved as a link
 * layer, so a layer added to the `LinkManager` is immediately recallable
 * without a second registration step. An unresolvable name recalls as empty
 * rather than throwing: which associative memories exist is a deployment
 * choice, and a premise strategy must degrade, not fail.
 */
export class AssociativeRegistry {
    layers;
    memories = new Map();
    constructor(layers) {
        this.layers = layers;
    }
    register(memory) {
        this.memories.set(memory.name, memory);
        return this;
    }
    get(name) {
        const explicit = this.memories.get(name);
        if (explicit)
            return explicit;
        if (!this.layers?.(name))
            return undefined;
        // Memoized, but the memo resolves the layer per recall, so replacing the
        // layer behind the name is still observed.
        return getOrInsert(this.memories, name, () => new LinkLayerMemory(name, () => this.layers?.(name)));
    }
    names() {
        return [...this.memories.keys()];
    }
    recall(name, term, options) {
        return this.get(name)?.recall(term, options) ?? [];
    }
    /** Record an association; `false` when the memory behind the name cannot write. */
    associate(name, from, to, options) {
        return this.get(name)?.associate?.(from, to, options) ?? false;
    }
}
