import { IncomingFromServer, type GraphOpType } from '../../shared/protocol.js';
import { $chat, $streamingDelta, $graphNodes, $graphEdges, $graphMeta, $config, $telemetry, $lastSeqId, $workingMemory } from './store.js';

const TELEMETRY_WINDOW = 300;

export function applyServerMessage(msg: IncomingFromServer) {
  switch (msg.type) {
    case 'chat.agent.stream':
      $streamingDelta.set($streamingDelta.get() + msg.delta);
      break;
    case 'chat.agent.complete':
      $chat.set([...$chat.get(), { role: 'agent', content: msg.content }]);
      $streamingDelta.set('');
      break;
    case 'cognitive.delta':
      if (msg.seq_id != null) $lastSeqId.set(msg.seq_id);
      if (msg.module === 'belief_graph') applyGraphOps(msg.ops, msg.meta);
      if (msg.module === 'working_memory') applyWorkingMemoryOps(msg.ops);
      break;
    case 'config.schema':
      $config.set(msg.data);
      break;
    case 'state.snapshot':
      $lastSeqId.set(msg.seq_id);
      applyFullSnapshot(msg.data);
      break;
    case 'seq.ack':
      $lastSeqId.set(msg.seq_id);
      break;
    case 'telemetry':
      appendTelemetry(msg);
      break;
  }
}

function applyFullSnapshot(data: { graph: { nodes: any[]; edges: any[] }; working_memory: any[]; config: Record<string, any> }) {
  const nodes = new Map<string, Record<string, any>>();
  for (const n of data.graph.nodes) nodes.set(n.id, n);
  $graphNodes.set(nodes);
  const edges = new Map<string, Record<string, any>>();
  for (const e of data.graph.edges) edges.set(`${e.source}->${e.target}`, e);
  $graphEdges.set(edges);
  $workingMemory.set(data.working_memory);
  $config.set(data.config);
}

function applyGraphOps(ops: GraphOpType[], meta?: { truncated?: boolean; total_hidden?: number }) {
  const nodes = new Map($graphNodes.get());
  const edges = new Map($graphEdges.get());
  for (const op of ops) {
    const edgeKey = (s: string, t: string) => `${s}->${t}`;
    switch (op.action) {
      case 'add_node':
        nodes.set(op.id, { id: op.id, ...op.data });
        break;
      case 'update_node':
        nodes.set(op.id, { ...nodes.get(op.id), ...op.data });
        break;
      case 'remove_node':
        nodes.delete(op.id);
        break;
      case 'add_edge':
        edges.set(edgeKey(op.source, op.target), { source: op.source, target: op.target, ...op.data });
        break;
      case 'remove_edge':
        edges.delete(edgeKey(op.source, op.target));
        break;
    }
  }
  $graphNodes.set(nodes);
  $graphEdges.set(edges);
  if (meta) $graphMeta.set({ truncated: meta.truncated ?? false, total_hidden: meta.total_hidden ?? 0 });
}

function applyWorkingMemoryOps(ops: any[]) {
  const wm = [...$workingMemory.get()];
  for (const op of ops) {
    if (op.action === 'add_node') wm.push({ id: op.id, ...op.data });
    if (op.action === 'remove_node') {
      const idx = wm.findIndex((x: any) => x.id === op.id);
      if (idx >= 0) wm.splice(idx, 1);
    }
  }
  $workingMemory.set(wm);
}

function appendTelemetry(msg: any) {
  const t = $telemetry.get();
  const push = (arr: number[], v: number) => {
    const next = [...arr, v];
    return next.length > TELEMETRY_WINDOW ? next.slice(next.length - TELEMETRY_WINDOW) : next;
  };
  $telemetry.set({
    reasoning_hz: push(t.reasoning_hz, msg.metrics.reasoning_hz),
    tokens_per_sec: push(t.tokens_per_sec, msg.metrics.tokens_per_sec),
    memory_mb: push(t.memory_mb, msg.metrics.memory_mb),
    ws_latency_ms: push(t.ws_latency_ms, msg.metrics.ws_latency_ms),
  });
}
