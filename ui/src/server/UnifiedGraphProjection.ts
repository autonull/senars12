import type { GraphNodeData, GraphOp, IncomingFromServer, Lens } from '@senars/core/protocol';
import type { GraphDelta, GraphEdgeData } from '@senars/core';
import type { LensSpec } from '@senars/core/lens-schema';
import { lensRegistry } from './gateway.js';
import { LENS_FIELDS } from '../shared/constants.js';
import { DEFAULT_PROJECTION } from './config.js';
import { computeActiveSubgraph } from './projection.js';

function nodeId(node: GraphNodeData): string {
  return node.id ?? node.term ?? node.atom ?? '';
}

export class UnifiedGraphProjection {
  #nodes = new Map<string, GraphNodeData>();
  #edges = new Map<string, { source: string; target: string; weight: number; type?: string }>();
  #seq = 0;
  #sendFn: ((msg: IncomingFromServer) => void) | null = null;
  #currentLens: Lens = 'belief';
  #focusTerm: string | null = null;

  mount(sendFn: (msg: IncomingFromServer) => void): void {
    this.#sendFn = sendFn;
  }

  unmount(): void {
    this.#sendFn = null;
  }

  applyDelta(delta?: GraphDelta): void {
    if (!delta) return;

    for (const node of delta.nodes) {
      const id = nodeId(node);
      if (!id) continue;
      const existing = this.#nodes.get(id);
      if (!existing || this.#shouldUpdate(existing, node)) {
        this.#nodes.set(id, node);
      }
    }

    for (const edge of delta.edges) {
      const key = `${edge.source}->${edge.target}`;
      const existing = this.#edges.get(key);
      if (!existing || (edge.weight ?? 1) > existing.weight) {
        this.#edges.set(key, {
          source: edge.source,
          target: edge.target,
          weight: edge.weight ?? 1,
          type: edge.type,
        });
      }
    }

    this.#sendDelta();
  }

  setLens(lens: Lens): void {
    this.#currentLens = lens;
    this.#sendDelta();
  }

  setFocus(term: string | null): void {
    this.#focusTerm = term;
    this.#sendDelta();
  }

  sendInitialState(): void {
    this.#sendFn?.({ type: 'lens.fields', fields: LENS_FIELDS });
    this.sendLensList();
    this.#sendDelta();
  }

  sendLensList(): void {
    const lenses: LensSpec[] = [...lensRegistry.values()];
    this.#sendFn?.({
      type: 'lens.list',
      lenses: lenses as LensSpec[],
    } as IncomingFromServer);
  }

  #shouldUpdate(existing: GraphNodeData, incoming: GraphNodeData): boolean {
    return (incoming.confidence ?? 0) > (existing.confidence ?? 0);
  }

  #sendDelta(): void {
    if (!this.#sendFn) return;

    const ops = this.#buildOps();
    this.#sendFn({
      type: 'cognitive.delta',
      seqId: ++this.#seq,
      lens: this.#currentLens,
      ops,
    });
  }

  #buildOps(): GraphOp[] {
    const concepts = [...this.#nodes.entries()].map(([id, n]) => ({
      id,
      priority: n.priority ?? 0.5,
      confidence: n.confidence ?? 0.5,
    }));

    const focusIds = this.#focusTerm
      ? new Set(
          computeActiveSubgraph(
            concepts.map((c) => ({
              term: c.id,
              priority: c.priority,
              confidence: c.confidence,
              getLinks: () => {
                const links: Array<{ target: string; strength: number }> = [];
                for (const edge of this.#edges.values()) {
                  if (edge.source === c.id) links.push({ target: edge.target, strength: edge.weight });
                  if (edge.target === c.id) links.push({ target: edge.source, strength: edge.weight });
                }
                return links;
              },
            })),
            this.#focusTerm,
            DEFAULT_PROJECTION
          ).nodes.map((n) => n.id)
        )
      : null;

    const scored = concepts
      .filter((c) => !focusIds || focusIds.has(c.id))
      .sort((a, b) => this.#scoreForLens(b) - this.#scoreForLens(a))
      .slice(0, DEFAULT_PROJECTION.maxNodes);

    const nodeIds = new Set(scored.map((s) => s.id));
    const ops: GraphOp[] = [];

    for (const [id, node] of this.#nodes) {
      if (nodeIds.has(id)) {
        ops.push({ action: 'add_node', id, data: node });
      }
    }

    for (const edge of this.#edges.values()) {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        ops.push({
          action: 'add_edge',
          source: edge.source,
          target: edge.target,
          data: { weight: edge.weight, type: edge.type ?? 'semantic', directed: true },
        });
      }
    }

    return ops;
  }

  #scoreForLens(node: { id: string; priority: number; confidence: number }): number {
    const nodeData = this.#nodes.get(node.id);
    const caps = (nodeData?.capabilities as string[]) ?? [];
    const score = this.#computeScore(caps, node);

    switch (this.#currentLens) {
      case 'belief':
        // Accept both NAR truth-revision nodes and MeTTa pattern-match/query nodes
        return score;
      case 'goal':
        return caps.includes('goal-management') ? node.priority : 0;
      case 'contradiction':
        return nodeData?.isContradiction ? 1 : 0;
      default:
        return score;
    }
  }

  #computeScore(caps: string[], node: { id: string; priority: number; confidence: number }): number {
    if (caps.includes('truth-revision') || caps.includes('pattern-match') || caps.includes('query')) {
      return node.confidence * node.priority;
    }
    // Default: accept nodes without capabilities too (for backward compatibility)
    return node.confidence * node.priority;
  }
}

