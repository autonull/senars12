/**
 * ConceptGraph — Trie-structured co-activation edges for RuleGraph.
 * Provides O(k) lookup where k = term depth, with fallback edges for non-regression.
 */

import type { Term } from '@senars/nar/terms';
import { serializeTerm } from '@senars/nar/terms';

interface ConceptNode {
  term: Term;
  children: Map<string, ConceptNode>;
  coActivations: Map<string, CoActivationEdge>;
  activationCount: number;
  lastActivated: number;
}

export interface CoActivationEdge {
  targetTerm: Term;
  weight: number;
  evidenceCount: number;
  lastUpdated: number;
}

export interface ConceptGraphOptions {
  maxNodes?: number;
  maxEdgesPerNode?: number;
  decayRate?: number;
  minEdgeWeight?: number;
}

export class ConceptGraph {
  private root: ConceptNode;
  private readonly maxNodes: number;
  private readonly maxEdgesPerNode: number;
  private readonly decayRate: number;
  private readonly minEdgeWeight: number;
  private nodeCount = 1; // root
  private edgeCount = 0;

  constructor(options: ConceptGraphOptions = {}) {
    this.maxNodes = options.maxNodes ?? 10000;
    this.maxEdgesPerNode = options.maxEdgesPerNode ?? 50;
    this.decayRate = options.decayRate ?? 0.001;
    this.minEdgeWeight = options.minEdgeWeight ?? 0.01;
    this.root = this.createNode({ kind: 'atom', symbol: 'ROOT' });
  }

  private createNode(term: Term): ConceptNode {
    return {
      term,
      children: new Map(),
      coActivations: new Map(),
      activationCount: 0,
      lastActivated: Date.now(),
    };
  }

  private getTermKey(term: Term): string {
    return serializeTerm(term);
  }

  private traversePath(term: Term, create = false): ConceptNode | null {
    let node = this.root;
    const args = this.getTermArgs(term);

    for (const arg of args) {
      const key = this.getTermKey(arg);
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

  private getTermArgs(term: Term): Term[] {
    if (term.kind === 'atom') return [term];
    return (term.args ?? []) as Term[];
  }

  /** Activate a concept and optionally record co-activation with another concept. */
  activate(term: Term, coActiveWith?: Term): void {
    const node = this.traversePath(term, true);
    if (!node) return;

    node.activationCount++;
    node.lastActivated = Date.now();

    if (coActiveWith) {
      const coActiveKey = this.getTermKey(coActiveWith);
      let edge = node.coActivations.get(coActiveKey);

      if (!edge) {
        if (node.coActivations.size >= this.maxEdgesPerNode) {
          this.pruneWeakestEdges(node);
        }
        edge = {
          targetTerm: coActiveWith,
          weight: 1,
          evidenceCount: 1,
          lastUpdated: Date.now(),
        };
        node.coActivations.set(coActiveKey, edge);
        this.edgeCount++;
      } else {
        edge.weight += 1;
        edge.evidenceCount++;
        edge.lastUpdated = Date.now();
      }
    }
  }

  /** Get co-activation edges for a concept, sorted by weight descending. */
  getCoActivations(term: Term, limit = 10): CoActivationEdge[] {
    const node = this.traversePath(term);
    if (!node) return [];

    return [...node.coActivations.values()]
      .filter((e) => e.weight >= this.minEdgeWeight)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
  }

  /** Get fallback edges — high-level structural connections for non-regression. */
  getFallbackEdges(term: Term): Term[] {
    const node = this.traversePath(term);
    if (!node) return [];

    const fallbacks: Term[] = [];
    for (const [, child] of node.children) {
      fallbacks.push(child.term);
      if (fallbacks.length >= 5) break;
    }
    return fallbacks;
  }

  /** Decay all edge weights and prune weak edges. */
  decay(): void {
    for (const node of this.allNodes()) {
      for (const [key, edge] of node.coActivations) {
        edge.weight *= 1 - this.decayRate;
        if (edge.weight < this.minEdgeWeight) {
          node.coActivations.delete(key);
          this.edgeCount--;
        }
      }
    }
  }

  private pruneWeakestEdges(node: ConceptNode): void {
    const edges = [...node.coActivations.entries()].sort((a, b) => a[1].weight - b[1].weight);
    const toRemove = edges.slice(0, Math.ceil(this.maxEdgesPerNode * 0.2));
    for (const [key] of toRemove) {
      node.coActivations.delete(key);
      this.edgeCount--;
    }
  }

  private *allNodes(): Generator<ConceptNode> {
    yield this.root;
    for (const child of this.root.children.values()) {
      yield* this.traverseNode(child);
    }
  }

  private *traverseNode(node: ConceptNode): Generator<ConceptNode> {
    yield node;
    for (const child of node.children.values()) {
      yield* this.traverseNode(child);
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
      children: [...node.children.entries()].map(([key, child]) => [key, this.serializeNode(child)]),
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

  /** Deserialize from persistence. */
  static deserialize(data: SerializedConceptGraph): ConceptGraph {
    const graph = new ConceptGraph({
      maxNodes: data.maxNodes,
      maxEdgesPerNode: data.maxEdgesPerNode,
      decayRate: data.decayRate,
      minEdgeWeight: data.minEdgeWeight,
    });
    graph.root = graph.deserializeNode(data.nodes);
    graph.nodeCount = graph.countNodes(graph.root);
    graph.edgeCount = graph.countEdges(graph.root);
    return graph;
  }

  private deserializeNode(node: SerializedConceptNode): ConceptNode {
    const result: ConceptNode = {
      term: node.term,
      children: new Map(),
      coActivations: new Map(),
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

  private countNodes(node: ConceptNode): number {
    let count = 1;
    for (const child of node.children.values()) {
      count += this.countNodes(child);
    }
    return count;
  }

  private countEdges(node: ConceptNode): number {
    let count = node.coActivations.size;
    for (const child of node.children.values()) {
      count += this.countEdges(child);
    }
    return count;
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