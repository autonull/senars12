import type { WebSocket } from 'ws';
import type { Agent } from '../../../src/agent/types.js';
import type { GraphOpType, IncomingFromServer, Lens } from '../shared/protocol.js';
import type { NarAdapter } from './gateway.js';
import { computeActiveSubgraph } from './projection.js';
import { DEFAULT_PROJECTION } from './config.js';
import { createNodeOp, createEdgeOp } from './graph-factory.js';
import { buildLensGraphOps } from './lenses.js';

type DeltaModule = 'belief_graph' | 'working_memory' | 'stream_reasoner';
const cn = (id: string, label: string, priority: number, confidence: number) =>
  createNodeOp(id, { id, label, priority, confidence, nodeType: 'concept' });

export function send(socket: WebSocket, msg: IncomingFromServer): void {
  socket.send(JSON.stringify(msg));
}

export function sendDelta(
  socket: WebSocket,
  module: DeltaModule,
  ops: GraphOpType[],
  meta?: { truncated: boolean; total_hidden: number },
  lens?: Lens,
): void {
  send(socket, { type: 'cognitive.delta', module, ops, meta, lens });
}

function beliefGraphDelta(adapter: NarAdapter, lens?: Lens): { ops: GraphOpType[]; meta?: { truncated: boolean; total_hidden: number } } {
  if (lens) return buildLensGraphOps(adapter, lens);
  const proj = computeActiveSubgraph(adapter.listConcepts(), null, DEFAULT_PROJECTION);
  return {
    ops: [...proj.nodes.map((n) => cn(n.id, n.id, n.priority, n.confidence)), ...proj.edges.map((e) => createEdgeOp(e.source, e.target, e.weight))],
    meta: proj.truncated ? { truncated: true, total_hidden: proj.total_hidden } : undefined,
  };
}

function workingMemoryDelta(adapter: NarAdapter): GraphOpType[] {
  return adapter.attentionReport().concepts.map((c: any) =>
    cn(c.term.toString(), c.term.toString(), c.priority, 0.9)
  );
}

function driveDelta(adapter: NarAdapter): GraphOpType[] | null {
  const drives = adapter.getDriveManager()?.getAllStates();
  return drives?.map((d) => cn(d.spec.id, d.spec.name, d.currentIntensity, 1)) ?? null;
}

export function sendInitialState(socket: WebSocket, adapter: NarAdapter, lens?: Lens): void {
  send(socket, { type: 'config.schema', data: adapter.getConfigSchema() });
  const bg = beliefGraphDelta(adapter, lens);
  sendDelta(socket, 'belief_graph', bg.ops, bg.meta, lens);
  sendDelta(socket, 'working_memory', workingMemoryDelta(adapter));
  const drives = driveDelta(adapter);
  if (drives) sendDelta(socket, 'stream_reasoner', drives);
}

type Unsubscribe = () => void;

export function subscribeNarEvents(socket: WebSocket, adapter: NarAdapter, currentLens: () => Lens): Unsubscribe[] {
  const bus = adapter.getSystemEventBus();
  return [
    bus.on('nar:derivation', () => {
      const { ops, meta } = beliefGraphDelta(adapter, currentLens());
      sendDelta(socket, 'belief_graph', ops, meta, currentLens());
    }),
    bus.on('nar:concept:activated', (d: any) => {
      const term = typeof d.term === 'object' ? d.term.toString() : String(d.term);
      sendDelta(socket, 'working_memory', [cn(term, term, d.priority ?? 0.5, 0.9)]);
    }),
    bus.on('nar:reasoning:cycle', (d: any) => {
      sendDelta(socket, 'stream_reasoner', [cn('cycle', 'cycle', d.cycle ?? 0, 1)]);
    }),
    bus.on('nar:drive:changed', (d: any) => {
      const id = d.drive ?? 'drive';
      sendDelta(socket, 'stream_reasoner', [cn(id, id, d.urgency ?? 0, 1)]);
    }),
  ];
}

function subscribeAgentEvents(socket: WebSocket, agent: Agent): Unsubscribe[] {
  const emitStatus = (p: number) => sendDelta(socket, 'stream_reasoner', [cn('status', 'status', p, 1)]);
  return [
    agent.on('agent:process:start', () => emitStatus(1)),
    agent.on('agent:process:complete', () => emitStatus(0)),
  ];
}

export function subscribeSocket(socket: WebSocket, adapter: NarAdapter, agent: Agent, currentLens: () => Lens): Unsubscribe {
  const all = [...subscribeNarEvents(socket, adapter, currentLens), ...subscribeAgentEvents(socket, agent)];
  return () => all.forEach((u) => u());
}
