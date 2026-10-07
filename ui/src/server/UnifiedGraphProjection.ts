import type { GraphNodeData, GraphOp, IncomingFromServer, LensSpec } from '@senars/core';
import { builtinLensSpecs } from '@senars/core';

export type GraphEdge = {
  source: string;
  target: string;
  type: string;
  weight?: number;
  directed?: boolean;
  truth?: { frequency: number; confidence: number };
  priority?: number;
  confidence?: number;
};

export type GraphDelta = {
  nodes: GraphNodeData[];
  edges: GraphEdge[];
};

export type ObjectPatch = {
  truth?: { frequency: number; confidence: number };
  type?: string;
  priority?: number;
  confidence?: number;
};

/**
 * The projection is the server's one graph state: engine events are folded in,
 * and every change is emitted as a monotonic `cognitive.delta`. The sequence is
 * an integer counter shared across senders — it used to be `Date.now()`, which
 * two deltas in the same millisecond could not order, breaking replay and `sync.request`.
 */
export class UnifiedGraphProjection {
  readonly #senders = new Set<(msg: IncomingFromServer) => void>();
  #nodes = new Map<string, GraphNodeData>();
  #edges = new Map<string, GraphEdge>();
  #lenses = new Map<string, LensSpec>();
  #currentLens = 'belief';
  #focusTerm = '';
  #seq = 0;

  mount(sender: (msg: IncomingFromServer) => void): void {
    this.#senders.add(sender);
  }

  unmount(sender?: (msg: IncomingFromServer) => void): void {
    if (sender) this.#senders.delete(sender);
    else this.#senders.clear();
  }

  get seq(): number {
    return this.#seq;
  }

  get lens(): string {
    return this.#currentLens;
  }

  /**
   * Return to the empty pre-connection state: no nodes/edges/lenses/focus and a
   * sequence counter at zero. The seq reset is what makes two runs of the same
   * scenario byte-identical, so a reconnecting client's `sync.request` sees the
   * same numbers as a first boot.
   */
  reset(): void {
    this.#nodes.clear();
    this.#edges.clear();
    this.#lenses.clear();
    this.#currentLens = 'belief';
    this.#focusTerm = '';
    this.#seq = 0;
  }

  #nextSeq(): number {
    return ++this.#seq;
  }

  applyDelta(delta: GraphDelta): void {
    const ops: GraphOp[] = [];
    for (const node of delta.nodes) {
      const id = node.id ?? node.term ?? `node-${this.#nextSeq()}`;
      const existing = this.#nodes.has(id);
      this.#nodes.set(id, node);
      ops.push({ action: existing ? 'update_node' : 'add_node', id, data: { ...node, id } });
    }

    for (const edge of delta.edges) {
      // An edge is only meaningful between known nodes; structural decorations
      // can reference bare terms that were never admitted as concepts. Skipping
      // them here keeps the wire and both renderers free of dangling edges.
      if (!this.#nodes.has(edge.source) || !this.#nodes.has(edge.target)) continue;
      this.#edges.set(this.#edgeId(edge), edge);
      ops.push({ action: 'add_edge', source: edge.source, target: edge.target, data: this.#edgeData(edge) });
    }

    this.#emitAll({ type: 'cognitive.delta', seqId: this.#nextSeq(), lens: this.#currentLens, ops });
  }

  graphSnapshot(): { nodes: GraphNodeData[]; edges: GraphEdge[] } {
    return { nodes: [...this.#nodes.values()], edges: [...this.#edges.values()] };
  }

  node(term: string): GraphNodeData | undefined {
    return this.#nodes.get(term);
  }

  applyObjectPatch(kind: 'node' | 'edge', id: string, patch: ObjectPatch): void {
    if (kind === 'node') {
      const existing = this.#nodes.get(id);
      if (!existing) return;
      const updated = { ...existing, ...patch } as GraphNodeData;
      this.#nodes.set(id, updated);
      this.#emitAll({
        type: 'cognitive.delta',
        seqId: this.#nextSeq(),
        lens: this.#currentLens,
        ops: [{ action: 'update_node', id, data: updated }],
      });
      return;
    }
    this.#applyEdgePatch(id, patch);
  }

  #applyEdgePatch(id: string, patch: ObjectPatch): void {
    const [source, target] = id.split('->');
    const entry = [...this.#edges.entries()].find(
      ([, e]) => e.source === source && e.target === target
    );
    if (!entry) return;
    const [key, edge] = entry;
    const updated: GraphEdge = { ...edge, ...patch };
    const ops: GraphOp[] = [{ action: 'remove_edge', source: edge.source, target: edge.target }];
    if (patch.type && patch.type !== edge.type) {
      this.#edges.delete(key);
      const nextKey = this.#edgeId(updated);
      this.#edges.set(nextKey, updated);
    } else {
      this.#edges.set(key, updated);
    }
    ops.push({
      action: 'add_edge',
      source: updated.source,
      target: updated.target,
      data: this.#edgeData(updated),
    });
    this.#emitAll({ type: 'cognitive.delta', seqId: this.#nextSeq(), lens: this.#currentLens, ops });
  }

  defineLens(spec: LensSpec): void {
    this.#lenses.set(spec.id, spec);
    this.#emitAll({ type: 'lens.defined', lens: spec });
  }

  removeNode(id: string): void {
    if (!this.#nodes.delete(id)) return;
    const ops: GraphOp[] = [{ action: 'remove_node', id }];
    for (const [key, edge] of this.#edges) {
      if (edge.source !== id && edge.target !== id) continue;
      this.#edges.delete(key);
      ops.push({ action: 'remove_edge', source: edge.source, target: edge.target });
    }
    this.#emitAll({ type: 'cognitive.delta', seqId: this.#nextSeq(), lens: this.#currentLens, ops });
  }

  markContradiction(...terms: string[]): void {
    const ops: GraphOp[] = [];
    for (const term of terms) {
      const existing = this.#nodes.get(term);
      if (!existing) continue;
      const updated = { ...existing, isContradiction: true } as GraphNodeData;
      this.#nodes.set(term, updated);
      ops.push({ action: 'update_node', id: term, data: updated });
    }
    if (ops.length === 0) return;
    this.#emitAll({ type: 'cognitive.delta', seqId: this.#nextSeq(), lens: this.#currentLens, ops });
  }

  lenses(): LensSpec[] {
    return [...this.#lenses.values()];
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

    this.#emitAll({ type: 'lens.list', lenses: [...builtinLensSpecs(), ...this.#lenses.values()] });

    const ops: GraphOp[] = [];
    for (const [id, data] of this.#nodes) {
      if (this.#focusTerm && id !== this.#focusTerm) continue;
      ops.push({ action: 'add_node', id, data });
    }
    for (const edge of this.#edges.values()) {
      ops.push({ action: 'add_edge', source: edge.source, target: edge.target, data: this.#edgeData(edge) });
    }
    this.#emitAll({ type: 'cognitive.delta', seqId: this.#seq, lens: this.#currentLens, ops });
  }

  setLens(lens: string): void {
    this.#currentLens = lens;
    this.#emitAll({ type: 'cognitive.delta', seqId: this.#nextSeq(), lens, ops: this.#nodeOps() });
  }

  setFocus(term: string): void {
    this.#focusTerm = term;
    this.#emitAll({
      type: 'cognitive.delta',
      seqId: this.#nextSeq(),
      lens: this.#currentLens,
      ops: this.#nodeOps(),
    });
  }

  #nodeOps(): GraphOp[] {
    return [...this.#nodes.entries()]
      .filter(([id]) => !this.#focusTerm || id === this.#focusTerm)
      .map(([id, data]) => ({ action: 'add_node' as const, id, data }));
  }

  #edgeId(edge: GraphEdge): string {
    return `${edge.source}->${edge.target}:${edge.type}`;
  }

  #edgeData(edge: GraphEdge): { weight: number; type: string; directed: boolean } {
    return { weight: edge.weight ?? 1, type: edge.type, directed: edge.directed ?? true };
  }

  #emitAll(msg: IncomingFromServer): void {
    for (const sender of this.#senders) {
      try {
        sender(msg);
      } catch {
        /* a broken socket must not silence the others */
      }
    }
  }
}
