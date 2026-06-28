import type { IncomingFromServer, GraphOpType, ChatMessage, GraphNodeData } from '../../shared/protocol.js';
import { $chat, $streamingDelta, $graphNodes, $graphEdges, $graphMeta, $config, $telemetry, $lastSeqId, $workingMemory } from './store.js';
import type { CognitiveMeta } from './store.js';

const TELEMETRY_WINDOW = 300;
const edgeKey = (source: string, target: string) => `${source}->${target}`;

let msgCounter = 0;
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++msgCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

function extractTerm(content: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed) return undefined;
  const words = trimmed.split(/\s+/);
  return words[0]?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || undefined;
}

export function addUserMessage(content: string): void {
  const chat: ChatMessage = {
    id: generateId('user'),
    role: 'user',
    content,
    timestamp: Date.now(),
    term: extractTerm(content),
    supports: [],
    contradicts: [],
    derivesFrom: [],
  };
  $chat.set([...$chat.get(), chat]);
}

export function applyServerMessage(msg: IncomingFromServer): void {
  switch (msg.type) {
    case 'chat.agent.stream':
      $streamingDelta.set($streamingDelta.get() + msg.delta);
      break;
    case 'chat.agent.complete': {
      const id = msg.messageId ?? generateId('agent');
      const chat: ChatMessage = {
        id,
        role: 'agent',
        content: msg.content,
        timestamp: Date.now(),
        term: extractTerm(msg.content),
        supports: [],
        contradicts: [],
        derivesFrom: [],
      };
      $chat.set([...$chat.get(), chat]);
      $streamingDelta.set('');
      break;
    }
    case 'cognitive.delta':
      if (msg.seq_id != null) $lastSeqId.set(msg.seq_id);
      if (msg.module === 'belief_graph') applyGraphOps(msg.ops, msg.meta);
      else if (msg.module === 'working_memory') applyWorkingMemoryOps(msg.ops);
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

function applyFullSnapshot(data: { graph: { nodes: any[]; edges: any[] }; working_memory: any[]; config: Record<string, any> }): void {
  const nodes = new Map<string, GraphNodeData>(data.graph.nodes.map((n) => [n.id, n as GraphNodeData]));
  const edges = new Map<string, Record<string, any>>(data.graph.edges.map((e) => [edgeKey(e.source, e.target), e]));
  $graphNodes.set(nodes);
  $graphEdges.set(edges);
  $workingMemory.set(data.working_memory);
  $config.set(data.config);
}

function applyGraphOps(ops: GraphOpType[], meta?: { truncated?: boolean; total_hidden?: number }): void {
  const nodes = new Map($graphNodes.get());
  const edges = new Map($graphEdges.get());
  for (const op of ops) {
    switch (op.action) {
      case 'add_node':
        nodes.set(op.id, op.data);
        break;
      case 'update_node': {
        const existing = nodes.get(op.id);
        if (existing) nodes.set(op.id, { ...existing, ...op.data } as GraphNodeData);
        break;
      }
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
  if (meta) $graphMeta.set({ truncated: meta.truncated ?? false, total_hidden: meta.total_hidden ?? 0 } satisfies CognitiveMeta);
}

function applyWorkingMemoryOps(ops: any[]): void {
  const removed = new Set<string>();
  const additions: any[] = [];
  for (const op of ops) {
    if (op.action === 'add_node') additions.push({ id: op.id, ...op.data });
    else if (op.action === 'remove_node') removed.add(op.id);
  }
  $workingMemory.set([
    ...$workingMemory.get().filter((x: any) => !removed.has(x.id)),
    ...additions,
  ]);
}

const pushWindow = (arr: number[], v: number) =>
  arr.length >= TELEMETRY_WINDOW ? [...arr.slice(arr.length - TELEMETRY_WINDOW + 1), v] : [...arr, v];

function appendTelemetry(msg: { metrics: { reasoning_hz: number; tokens_per_sec: number; memory_mb: number; ws_latency_ms: number } }): void {
  const t = $telemetry.get();
  $telemetry.set({
    reasoning_hz: pushWindow(t.reasoning_hz, msg.metrics.reasoning_hz),
    tokens_per_sec: pushWindow(t.tokens_per_sec, msg.metrics.tokens_per_sec),
    memory_mb: pushWindow(t.memory_mb, msg.metrics.memory_mb),
    ws_latency_ms: pushWindow(t.ws_latency_ms, msg.metrics.ws_latency_ms),
  });
}
