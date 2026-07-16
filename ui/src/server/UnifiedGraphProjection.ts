import type { GraphOp, IncomingFromServer, GraphNodeData } from '@senars/core';

export type GraphDelta = { nodes: GraphNodeData[]; edges: Array<{ source: string; target: string; type: string }> };

export class UnifiedGraphProjection {
  readonly #senders = new Set<(msg: IncomingFromServer) => void>();
  #nodes = new Map<string, GraphNodeData>();
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

    const ops: GraphOp[] = [];
    for (const node of delta.nodes) {
      ops.push({ action: 'add_node', id: node.id ?? node.term ?? `node-${Date.now()}`, data: node });
    }

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
      lenses: [
        { id: 'belief', label: 'Belief', description: 'Current convictions' },
        { id: 'goal', label: 'Goal', description: 'Active drives' },
        { id: 'contradiction', label: 'Contradiction', description: 'Tension pairs' },
        { id: 'temporal', label: 'Temporal', description: 'Time-ordered view' },
      ],
    });

    this.#emitAll({
      type: 'cognitive.delta',
      seqId: 0,
      lens: this.#currentLens,
      ops: [...this.#nodes.entries()]
        .filter(([id]) => !this.#focusTerm || id === this.#focusTerm)
        .map(([id, data]) => ({ action: 'add_node' as const, id, data })),
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
      try { sender(msg); } catch { /* ignore */ }
    }
  }
}
