import type { WebSocket } from 'ws';
import type { Agent } from '../../../src/agent/types.js';
import type { NAR } from '../../../src/nar/nar.js';
import type { GraphOpType, IncomingFromServer, Lens } from '../shared/protocol.js';
import type { NarAdapter } from './gateway.js';
import { computeActiveSubgraph, type ProjectionOptions } from './projection.js';
import { buildLensGraphOps } from './lenses.js';

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
  lens?: Lens,
): void {
  send(socket, { type: 'cognitive.delta', module, ops, meta, lens });
}

function beliefGraphDelta(adapter: NarAdapter, lens?: Lens): { ops: GraphOpType[]; meta?: { truncated: boolean; total_hidden: number } } {
  if (lens) {
    return buildLensGraphOps(adapter, lens);
  }
  const proj = computeActiveSubgraph(adapter.listConcepts(), null, DEFAULT_PROJECTION);
  const ops: GraphOpType[] = [
    ...proj.nodes.map((n) => ({
      action: 'add_node' as const,
      id: n.id,
      data: {
        id: n.id, label: n.id, priority: n.priority, confidence: n.confidence,
        nodeType: 'concept' as const,
      },
    })),
    ...proj.edges.map((e) => ({
      action: 'add_edge' as const,
      source: e.source, target: e.target,
      data: { weight: e.weight, type: 'semantic' },
    })),
  ];
  return { ops, meta: proj.truncated ? { truncated: true, total_hidden: proj.total_hidden } : undefined };
}

function workingMemoryDelta(adapter: NarAdapter): GraphOpType[] {
  return adapter.attentionReport().concepts.map((c: any) => ({
    action: 'add_node' as const,
    id: c.term.toString(),
    data: { id: c.term.toString(), label: c.term.toString(), priority: c.priority, confidence: 0.9, nodeType: 'concept' as const },
  }));
}

function driveDelta(adapter: NarAdapter): GraphOpType[] | null {
  const drives = adapter.getDriveManager()?.getAllStates();
  if (!drives) return null;
  return drives.map((d) => ({
    action: 'add_node' as const,
    id: d.spec.id,
    data: { id: d.spec.id, label: d.spec.name, priority: d.currentIntensity, confidence: 1, nodeType: 'concept' as const },
  }));
}

export function sendInitialState(socket: WebSocket, adapter: NarAdapter, nar: NAR, lens?: Lens): void {
  send(socket, { type: 'config.schema', data: adapter.getConfigSchema() });

  const initial = beliefGraphDelta(adapter, lens);
  sendDelta(socket, 'belief_graph', initial.ops, initial.meta, lens);

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
      sendDelta(socket, 'working_memory', [{
        action: 'add_node', id: term,
        data: { id: term, label: term, priority: d.priority ?? 0.5, confidence: 0.9, nodeType: 'concept' as const },
      }]);
    }),
    bus.on('nar:reasoning:cycle', (d: any) => {
      sendDelta(socket, 'stream_reasoner', [{
        action: 'add_node', id: 'cycle',
        data: { id: 'cycle', label: 'cycle', priority: d.cycle ?? 0, confidence: 1, nodeType: 'concept' as const },
      }]);
    }),
    bus.on('nar:drive:changed', (d: any) => {
      sendDelta(socket, 'stream_reasoner', [{
        action: 'add_node', id: d.drive ?? 'drive',
        data: { id: d.drive ?? 'drive', label: d.drive ?? 'drive', priority: d.urgency ?? 0, confidence: 1, nodeType: 'concept' as const },
      }]);
    }),
  ];
}

function subscribeAgentEvents(socket: WebSocket, agent: Agent): Unsubscribe[] {
  const emitStatus = (priority: number) =>
    sendDelta(socket, 'stream_reasoner', [{
      action: 'add_node', id: 'status',
      data: { id: 'status', label: 'status', priority, confidence: 1, nodeType: 'concept' as const },
    }]);
  return [
    agent.on('agent:process:start', () => emitStatus(1)),
    agent.on('agent:process:complete', () => emitStatus(0)),
  ];
}

export function subscribeSocket(socket: WebSocket, adapter: NarAdapter, agent: Agent, currentLens: () => Lens): Unsubscribe {
  const all = [...subscribeNarEvents(socket, adapter, currentLens), ...subscribeAgentEvents(socket, agent)];
  return () => all.forEach((u) => u());
}
