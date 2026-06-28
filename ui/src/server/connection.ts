import type { WebSocket } from 'ws';
import type { Agent } from '../../../src/agent/types.js';
import type { NAR } from '../../../src/nar/nar.js';
import type { GraphOpType, IncomingFromServer } from '../shared/protocol.js';
import type { NarAdapter } from './gateway.js';
import { computeActiveSubgraph, type ProjectionOptions } from './projection.js';

const DEFAULT_PROJECTION: ProjectionOptions = { maxNodes: 300, maxEdges: 600, maxHops: 2 };
type DeltaModule = 'belief_graph' | 'working_memory' | 'stream_reasoner';

export function send(socket: WebSocket, msg: IncomingFromServer): void {
  socket.send(JSON.stringify(msg));
}

export function sendDelta(
  socket: WebSocket,
  module: DeltaModule,
  ops: GraphOpType[],
  meta?: { truncated: boolean; total_hidden: number },
): void {
  send(socket, { type: 'cognitive.delta', module, ops, meta });
}

function beliefGraphDelta(adapter: NarAdapter): { ops: GraphOpType[]; meta?: { truncated: boolean; total_hidden: number } } {
  const proj = computeActiveSubgraph(adapter.listConcepts(), null, DEFAULT_PROJECTION);
  const ops: GraphOpType[] = [
    ...proj.nodes.map((n) => ({ action: 'add_node' as const, id: n.id, data: { priority: n.priority, confidence: n.confidence } })),
    ...proj.edges.map((e) => ({ action: 'add_edge' as const, source: e.source, target: e.target, data: { weight: e.weight } })),
  ];
  return { ops, meta: proj.truncated ? { truncated: true, total_hidden: proj.total_hidden } : undefined };
}

function workingMemoryDelta(adapter: NarAdapter): GraphOpType[] {
  return adapter.attentionReport().concepts.map((c: any) => ({
    action: 'add_node' as const,
    id: c.term.toString(),
    data: { priority: c.priority, confidence: 0.9 },
  }));
}

function driveDelta(adapter: NarAdapter): GraphOpType[] | null {
  const drives = adapter.getDriveManager()?.getAllStates();
  if (!drives) return null;
  return drives.map((d) => ({
    action: 'add_node' as const,
    id: d.spec.id,
    data: { priority: d.currentIntensity, confidence: 1 },
  }));
}

export function sendInitialState(socket: WebSocket, adapter: NarAdapter, nar: NAR): void {
  send(socket, { type: 'config.schema', data: adapter.getConfigSchema() });

  const initial = beliefGraphDelta(adapter);
  sendDelta(socket, 'belief_graph', initial.ops, initial.meta);

  sendDelta(socket, 'working_memory', workingMemoryDelta(adapter));

  const drives = driveDelta(adapter);
  if (drives) sendDelta(socket, 'stream_reasoner', drives);
}

type Unsubscribe = () => void;

function subscribeNarEvents(socket: WebSocket, adapter: NarAdapter): Unsubscribe[] {
  const bus = adapter.getSystemEventBus();
  return [
    bus.on('nar:derivation', () => {
      const { ops, meta } = beliefGraphDelta(adapter);
      sendDelta(socket, 'belief_graph', ops, meta);
    }),
    bus.on('nar:concept:activated', (d: any) => {
      const term = typeof d.term === 'object' ? d.term.toString() : String(d.term);
      sendDelta(socket, 'working_memory', [{ action: 'add_node', id: term, data: { priority: d.priority ?? 0.5, confidence: 0.9 } }]);
    }),
    bus.on('nar:reasoning:cycle', (d: any) => {
      sendDelta(socket, 'stream_reasoner', [{ action: 'add_node', id: 'cycle', data: { priority: d.cycle ?? 0, confidence: 1 } }]);
    }),
    bus.on('nar:drive:changed', (d: any) => {
      sendDelta(socket, 'stream_reasoner', [{ action: 'add_node', id: d.drive ?? 'drive', data: { priority: d.urgency ?? 0, confidence: 1 } }]);
    }),
  ];
}

function subscribeAgentEvents(socket: WebSocket, agent: Agent): Unsubscribe[] {
  const emitStatus = (priority: number) =>
    sendDelta(socket, 'stream_reasoner', [{ action: 'add_node', id: 'status', data: { priority, confidence: 1 } }]);
  return [
    agent.on('agent:process:start', () => emitStatus(1)),
    agent.on('agent:process:complete', () => emitStatus(0)),
  ];
}

export function subscribeSocket(socket: WebSocket, adapter: NarAdapter, agent: Agent): Unsubscribe {
  const all = [...subscribeNarEvents(socket, adapter), ...subscribeAgentEvents(socket, agent)];
  return () => all.forEach((u) => u());
}
