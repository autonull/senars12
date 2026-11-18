/**
 * ConceptGraph — Trie-structured co-activation edges for RuleGraph.
 * Provides O(k) lookup where k = term depth, with fallback edges for non-regression.
 */

import { BoundedMap, type Clock, collectUpTo, retain, selectTopN, systemClock } from '@senars/util';
import type { Term } from '../terms/index.js';
import { atom, getArgs, termKey } from '../terms/index.js';

interface ConceptNode {
  term: Term;
  children: Map<string, ConceptNode>;
  coActivations: BoundedMap<string, CoActivationEdge>;
  activationCount: number;
  lastActivated: number;
}

export interface CoActivationEdge {
  targetTerm: Term;
  weight: number;
  evidenceCount: number;
  lastUpdated: number;
}

export const one = (): number => 1;

export interface ConceptGraphOptions {
  maxNodes?: number;
  maxEdgesPerNode?: number;
  decayRate?: number;
  minEdgeWeight?: number;
  /** Injected clock for `lastActivated`/`lastUpdated` (default `systemClock`). */
  clock?: Clock;
}

/**
 * Every node in the trie below `root`, root included, in pre-order.
 *
 * The one traversal. Counting nodes, counting edges, decaying the graph and
 * serialising it each walked the same trie with its own recursion — four
 * traversals of one shape, and the count that `deserialize` restores into
 * `nodeCount`/`edgeCount` was the fifth. A fold over this is the walk each of
 * them wanted.
 */
function* walkTrie(node: ConceptNode): Generator<ConceptNode> {
  yield node;
  for (const child of node.children.values()) yield* walkTrie(child);
}

export class ConceptGraph {
  private root: ConceptNode;
  private readonly maxNodes: number;
  private readonly maxEdgesPerNode: number;
  private readonly decayRate: number;
  private readonly minEdgeWeight: number;
  private readonly now: Clock;
  private nodeCount = 1; // root
  private edgeCount = 0;

  constructor(options: ConceptGraphOptions = {}) {
    this.now = options.clock ?? systemClock;
    this.maxNodes = options.maxNodes ?? 10000;
    this.maxEdgesPerNode = options.maxEdgesPerNode ?? 50;
    this.decayRate = options.decayRate ?? 0.001;
    this.minEdgeWeight = options.minEdgeWeight ?? 0.01;
    this.root = this.createNode(atom('ROOT'));
  }

  private createNode(term: Term): ConceptNode {
    return {
      term,
      children: new Map(),
      coActivations: this.createEdgeBag(),
      activationCount: 0,
      lastActivated: this.now(),
    };
  }

  /** Per-node edge budget: weakest edge loses the slot, and `edgeCount` follows. */
  private createEdgeBag(): BoundedMap<string, CoActivationEdge> {
    return new BoundedMap({
      maxSize: this.maxEdgesPerNode,
      eviction: { by: (edge: CoActivationEdge) => edge.weight },
      onEvict: () => {
        this.edgeCount--;
      },
    });
  }

  private traversePath(term: Term, create = false): ConceptNode | null {
    let node = this.root;
    const args = getArgs(term);

    for (const arg of args) {
      const key = termKey(arg);
      let child = node.children.get(key);
      if (!child) {
        if (!create) return null;
        if (this.nodeCount >= this.maxNodes) return null;
        child = this.createNode(arg);
        node.children.set(key, child);
        this.nodeCount++;
      }
      node = child;
    }
    return node;
  }

  /** Activate a concept and optionally record co-activation with another concept. */
  activate(term: Term, coActiveWith?: Term): void {
    const node = this.traversePath(term, true);
    if (!node) return;

    node.activationCount++;
    node.lastActivated = this.now();

    if (coActiveWith) {
      const coActiveKey = termKey(coActiveWith);
      let edge = node.coActivations.get(coActiveKey);

      if (!edge) {
        edge = {
          targetTerm: coActiveWith,
          weight: 1,
          evidenceCount: 1,
          lastUpdated: this.now(),
        };
        node.coActivations.set(coActiveKey, edge);
        this.edgeCount++;
      } else {
        edge.weight += 1;
        edge.evidenceCount++;
        edge.lastUpdated = this.now();
      }
    }
  }

  /** Get co-activation edges for a concept, sorted by weight descending. */
  getCoActivations(term: Term, limit = 10): CoActivationEdge[] {
    const node = this.traversePath(term);
    if (!node) return [];

    return selectTopN(
      node.coActivations.values(),
      limit,
      (e) => e.weight,
      (e) => e.weight >= this.minEdgeWeight
    );
  }

  /** Get fallback edges — high-level structural connections for non-regression. */
  getFallbackEdges(term: Term): Term[] {
    const node = this.traversePath(term);
    if (!node) return [];

    return collectUpTo(node.children.values(), 5, (child) => child.term);
  }

  /** Decay all edge weights and prune weak edges. */
  decay(): void {
    for (const node of walkTrie(this.root)) {
      for (const [key, edge] of node.coActivations) {
        edge.weight = retain(edge.weight, this.decayRate);
        if (edge.weight < this.minEdgeWeight) {
          node.coActivations.delete(key);
          this.edgeCount--;
        }
      }
    }
  }

  /** Get graph statistics. */
  getStats(): { nodes: number; edges: number; maxNodes: number } {
    return { nodes: this.nodeCount, edges: this.edgeCount, maxNodes: this.maxNodes };
  }

  /** Serialize for persistence. */
  serialize(): SerializedConceptGraph {
    return {
      nodes: this.serializeNode(this.root),
      maxNodes: this.maxNodes,
      maxEdgesPerNode: this.maxEdgesPerNode,
      decayRate: this.decayRate,
      minEdgeWeight: this.minEdgeWeight,
    };
  }

  private serializeNode(node: ConceptNode): SerializedConceptNode {
    return {
      term: node.term,
      activationCount: node.activationCount,
      lastActivated: node.lastActivated,
      children: [...node.children.entries()].map(([key, child]) => [
        key,
        this.serializeNode(child),
      ]),
      coActivations: [...node.coActivations.entries()].map(([key, edge]) => [
        key,
        {
          targetTerm: edge.targetTerm,
          weight: edge.weight,
          evidenceCount: edge.evidenceCount,
          lastUpdated: edge.lastUpdated,
        },
      ]),
    };
  }

  /** Deserialize from persistence. An injected clock must be re-supplied by the caller. */
  static deserialize(data: SerializedConceptGraph, options: { clock?: Clock } = {}): ConceptGraph {
    const graph = new ConceptGraph({
      maxNodes: data.maxNodes,
      maxEdgesPerNode: data.maxEdgesPerNode,
      decayRate: data.decayRate,
      minEdgeWeight: data.minEdgeWeight,
      clock: options.clock,
    });
    graph.root = graph.deserializeNode(data.nodes);
    graph.nodeCount = graph.count(graph.root, one);
    graph.edgeCount = graph.count(graph.root, (n) => n.coActivations.size());
    return graph;
  }

  private deserializeNode(node: SerializedConceptNode): ConceptNode {
    const result: ConceptNode = {
      term: node.term,
      children: new Map(),
      coActivations: this.createEdgeBag(),
      activationCount: node.activationCount,
      lastActivated: node.lastActivated,
    };
    for (const [key, child] of node.children) {
      result.children.set(key, this.deserializeNode(child));
    }
    for (const [key, edge] of node.coActivations) {
      result.coActivations.set(key, edge);
    }
    return result;
  }

  private count(node: ConceptNode, weight: (node: ConceptNode) => number): number {
    let total = 0;
    for (const current of walkTrie(node)) total += weight(current);
    return total;
  }
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
  coActivations: Array<
    [string, { targetTerm: Term; weight: number; evidenceCount: number; lastUpdated: number }]
  >;
}
