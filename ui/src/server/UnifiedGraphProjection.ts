import type { GraphNodeData, GraphOp, IncomingFromServer } from '@senars/core';
import { builtinLensSpecs } from '@senars/core';

export type GraphDelta = {
  nodes: GraphNodeData[];
  edges: Array<{ source: string; target: string; type: string; weight?: number; directed?: boolean }>;
};

export class UnifiedGraphProjection {
  readonly #senders = new Set<(msg: IncomingFromServer) => void>();
  #nodes = new Map<string, GraphNodeData>();
  #edges = new Map<string, { source: string; target: string; type: string; weight?: number; directed?: boolean }>();
  #currentLens = 'belief';
  #focusTerm = '';

  mount(sender: (msg: IncomingFromServer) => void): void {
    this.#senders.add(sender);
  }

  unmount(sender?: (msg: IncomingFromServer) => void): void {
    if (sender) this.#senders.delete(sender);
    else this.#senders.clear();
  }

  applyDelta(delta: GraphDelta): void {
    for (const node of delta.nodes) {
      this.#nodes.set(node.id ?? node.term ?? `node-${Date.now()}`, node);
    }

    for (const edge of delta.edges) {
      const edgeId = `${edge.source}->${edge.target}:${edge.type}`;
      this.#edges.set(edgeId, edge);
    }

    const ops: GraphOp[] = [];
    for (const node of delta.nodes) {
      ops.push({
        action: 'add_node',
        id: node.id ?? node.term ?? `node-${Date.now()}`,
        data: node,
      });
    }

    for (const edge of delta.edges) {
      ops.push({
        action: 'add_edge',
        source: edge.source,
        target: edge.target,
        data: { weight: edge.weight ?? 1, type: edge.type, directed: edge.directed ?? true },
      });
    }

    console.log('[Projection.applyDelta] Emitting cognitive.delta with', ops.length, 'ops');
    this.#emitAll({
      type: 'cognitive.delta',
      seqId: Date.now(),
      lens: this.#currentLens,
      ops,
    });
  }

  sendInitialState(): void {
    this.#emitAll({
      type: 'lens.fields',
      fields: [
        { key: 'belief', label: 'Belief', type: 'string' },
        { key: 'goal', label: 'Goal', type: 'string' },
        { key: 'contradiction', label: 'Contradiction', type: 'string' },
        { key: 'temporal', label: 'Temporal', type: 'string' },
      ],
    });

    this.#emitAll({
      type: 'lens.list',
      lenses: builtinLensSpecs().map((spec) => ({
        id: spec.id,
        label: spec.label,
        description: spec.description,
        modulation: spec.modulation,
        requires: spec.requires,
      })),
    });

    const ops: GraphOp[] = [];
    for (const [id, data] of this.#nodes) {
      if (this.#focusTerm && id !== this.#focusTerm) continue;
      ops.push({ action: 'add_node', id, data });
    }
    for (const [, edge] of this.#edges) {
      ops.push({
        action: 'add_edge',
        source: edge.source,
        target: edge.target,
        data: { weight: edge.weight ?? 1, type: edge.type, directed: edge.directed ?? true },
      });
    }
    this.#emitAll({
      type: 'cognitive.delta',
      seqId: 0,
      lens: this.#currentLens,
      ops,
    });
  }

  setLens(lens: string): void {
    this.#currentLens = lens;
    this.#emitAll({
      type: 'cognitive.delta',
      seqId: Date.now(),
      lens,
      ops: [...this.#nodes.entries()]
        .filter(([id]) => !this.#focusTerm || id === this.#focusTerm)
        .map(([id, data]) => ({ action: 'add_node' as const, id, data })),
    });
  }

  setFocus(term: string): void {
    this.#focusTerm = term;
    this.#emitAll({
      type: 'cognitive.delta',
      seqId: Date.now(),
      lens: this.#currentLens,
      ops: [...this.#nodes.entries()]
        .filter(([id]) => !term || id === term)
        .map(([id, data]) => ({ action: 'add_node' as const, id, data })),
    });
  }

  #emitAll(msg: IncomingFromServer): void {
    for (const sender of this.#senders) {
      try {
        sender(msg);
      } catch {
        /* ignore */
      }
    }
  }
}
