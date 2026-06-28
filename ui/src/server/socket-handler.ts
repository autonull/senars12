import type { WebSocket } from 'ws';
import type { Agent } from '../../../src/agent/types.js';
import type { GraphOp, IncomingFromServer, Lens, GraphNodeData } from '../shared/protocol.js';
import type { NarAdapter } from './gateway.js';
import { computeActiveSubgraph } from './projection.js';
import { DEFAULT_PROJECTION } from './config.js';
import { buildLensGraphOps } from './lenses.js';

function createNodeOp(id: string, data: GraphNodeData): GraphOp {
  return { action: 'add_node' as const, id, data };
}

function createEdgeOp(source: string, target: string, weight: number, type = 'semantic'): GraphOp {
  return { action: 'add_edge' as const, source, target, data: { weight, type, directed: true } };
}

const cn = (id: string, label: string, priority: number, confidence: number, lensData?: { score: number; color: string; size: number }) =>
  createNodeOp(id, { id, label, priority, confidence, nodeType: 'concept', lensData });

export function send(socket: WebSocket, msg: IncomingFromServer): void {
  socket.send(JSON.stringify(msg));
}

function beliefGraphDelta(adapter: NarAdapter, lens?: Lens): { ops: GraphOp[]; meta?: { truncated: boolean; totalHidden: number } } {
  if (lens) return buildLensGraphOps(adapter, lens);
  const concepts = adapter.listConcepts();
  const proj = computeActiveSubgraph(concepts, null, DEFAULT_PROJECTION);
  const nodeSet = new Set(proj.nodes.map(n => n.id));

  return {
    ops: [
      ...concepts.filter(c => nodeSet.has(c.term)).map((c) =>
        cn(c.term, c.term, c.priority, c.confidence, c.lensData)
      ),
      ...proj.edges.map((e) => createEdgeOp(e.source, e.target, e.weight)),
    ],
    meta: proj.truncated ? { truncated: true, totalHidden: proj.total_hidden } : undefined,
  };
}

function workingMemoryDelta(adapter: NarAdapter): GraphOp[] {
  return adapter.attentionReport().concepts.map((c) =>
    cn(c.term.toString(), c.term.toString(), c.priority, 0.9)
  );
}

function driveDelta(adapter: NarAdapter): GraphOp[] | null {
  const drives = adapter.getDriveManager()?.getAllStates();
  return drives?.map((d) => cn(d.spec.id, d.spec.name, d.currentIntensity, 1)) ?? null;
}

export function sendInitialState(socket: WebSocket, adapter: NarAdapter, lens?: Lens): void {
  send(socket, { type: 'config.schema', data: adapter.getConfigSchema() });
  const bg = beliefGraphDelta(adapter, lens);
  send(socket, { type: 'cognitive.delta', seqId: Date.now(), lens: lens ?? 'belief', ops: bg.ops, meta: bg.meta });
  send(socket, { type: 'cognitive.delta', seqId: Date.now() + 1, lens: 'belief', ops: workingMemoryDelta(adapter) });
  const drives = driveDelta(adapter);
  if (drives) send(socket, { type: 'cognitive.delta', seqId: Date.now() + 2, lens: 'belief', ops: drives });
}

type Unsubscribe = () => void;

export function subscribeNarEvents(socket: WebSocket, adapter: NarAdapter, currentLens: () => Lens): Unsubscribe[] {
  let seqId = Date.now();
  const bus = adapter.getSystemEventBus();
  return [
    bus.on('nar:derivation', () => {
      const { ops, meta } = beliefGraphDelta(adapter, currentLens());
      send(socket, { type: 'cognitive.delta', seqId: ++seqId, lens: currentLens(), ops, meta });
    }),
    bus.on('nar:concept:activated', (d: { term?: unknown; priority?: number }) => {
      const term = d.term ? (typeof d.term === 'object' ? d.term.toString() : String(d.term)) : '';
      send(socket, { type: 'cognitive.delta', seqId: ++seqId, lens: 'belief', ops: [cn(term, term, d.priority ?? 0.5, 0.9)] });
    }),
    bus.on('nar:reasoning:cycle', (d: { cycle?: number }) => {
      send(socket, { type: 'cognitive.delta', seqId: ++seqId, lens: 'belief', ops: [cn('cycle', 'cycle', d.cycle ?? 0, 1)] });
    }),
    bus.on('nar:drive:changed', (d: { drive?: string; urgency?: number }) => {
      const id = d.drive ?? 'drive';
      send(socket, { type: 'cognitive.delta', seqId: ++seqId, lens: 'belief', ops: [cn(id, id, d.urgency ?? 0, 1)] });
    }),
  ];
}

function subscribeAgentEvents(socket: WebSocket, agent: Agent): Unsubscribe[] {
  let seqId = Date.now();
  const emitStatus = (p: number) => send(socket, { type: 'cognitive.delta', seqId: ++seqId, lens: 'belief', ops: [cn('status', 'status', p, 1)] });
  return [
    agent.on('agent:process:start', () => emitStatus(1)),
    agent.on('agent:process:complete', () => emitStatus(0)),
  ];
}

export function subscribeSocket(socket: WebSocket, adapter: NarAdapter, agent: Agent, currentLens: () => Lens): Unsubscribe {
  const all = [...subscribeNarEvents(socket, adapter, currentLens), ...subscribeAgentEvents(socket, agent)];
  return () => all.forEach((u) => u());
}