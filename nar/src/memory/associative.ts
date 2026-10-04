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

import { getOrInsert } from '@senars/util';
import type { ConceptGraph } from './ConceptGraph.js';
import type { Layer } from './links/Layer.js';
import type { LinkType } from './links/types.js';
import type { Term } from '../terms/index.js';

/** Name of the co-activation graph memory. */
export const GRAPH_MEMORY = 'graph';

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
export class LinkLayerMemory implements AssociativeMemory {
  constructor(
    readonly name: string,
    private readonly layer: () => Layer | undefined
  ) {}

  recall(term: Term, { limit = 10, minStrength = 0 }: RecallOptions = {}): RecallHit[] {
    return (this.layer()?.getLinksByTerm(term, { minPriority: minStrength, maxResults: limit }) ?? []).map(
      (link) => ({ term: link.targetTerm, strength: link.priority })
    );
  }

  associate(from: Term, to: Term, { strength, type }: AssociateOptions = {}): boolean {
    const layer = this.layer();
    if (!layer) return false;
    return layer.addLink({ sourceTerm: from, targetTerm: to, priority: strength, type }) !== null;
  }
}

/** Associative memory over the bounded co-activation graph. */
export class GraphMemory implements AssociativeMemory {
  readonly name = GRAPH_MEMORY;

  constructor(
    private readonly graph: ConceptGraph,
    private readonly limit = 20
  ) {}

  recall(term: Term, { limit, minStrength = 0 }: RecallOptions = {}): RecallHit[] {
    return this.graph
      .getCoActivations(term, limit ?? this.limit)
      .filter((edge) => edge.weight >= minStrength)
      .map((edge) => ({ term: edge.targetTerm, strength: edge.weight }));
  }
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
export class AssociativeRegistry {
  private readonly memories = new Map<string, AssociativeMemory>();

  constructor(private readonly layers?: LinkLayerResolver) {}

  register(memory: AssociativeMemory): this {
    this.memories.set(memory.name, memory);
    return this;
  }

  get(name: string): AssociativeMemory | undefined {
    const explicit = this.memories.get(name);
    if (explicit) return explicit;
    if (!this.layers?.(name)) return undefined;

    // Memoized, but the memo resolves the layer per recall, so replacing the
    // layer behind the name is still observed.
    return getOrInsert(this.memories, name, () => new LinkLayerMemory(name, () => this.layers?.(name)));
  }

  names(): string[] {
    return [...this.memories.keys()];
  }

  recall(name: string, term: Term, options?: RecallOptions): RecallHit[] {
    return this.get(name)?.recall(term, options) ?? [];
  }

  /** Record an association; `false` when the memory behind the name cannot write. */
  associate(name: string, from: Term, to: Term, options?: AssociateOptions): boolean {
    return this.get(name)?.associate?.(from, to, options) ?? false;
  }
}
