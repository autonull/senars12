import { z } from 'zod';

// --- Chat ---
export const ChatUserMsg = z.object({
  type: z.literal('chat.user'),
  content: z.string().min(1).max(10000),
});
export const ChatAgentStream = z.object({
  type: z.literal('chat.agent.stream'),
  delta: z.string(),
});
export const ChatAgentComplete = z.object({
  type: z.literal('chat.agent.complete'),
  content: z.string(),
});

// --- Cognitive State (Delta-based) ---
export const GraphOp = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_node'), id: z.string(), data: z.object({ priority: z.number(), confidence: z.number() }) }),
  z.object({ action: z.literal('update_node'), id: z.string(), data: z.object({ priority: z.number(), confidence: z.number() }).partial() }),
  z.object({ action: z.literal('remove_node'), id: z.string() }),
  z.object({ action: z.literal('add_edge'), source: z.string(), target: z.string(), data: z.object({ weight: z.number() }).optional() }),
  z.object({ action: z.literal('remove_edge'), source: z.string(), target: z.string() }),
]);

export const CognitiveDelta = z.object({
  type: z.literal('cognitive.delta'),
  module: z.enum(['belief_graph', 'working_memory', 'stream_reasoner']),
  ops: z.array(GraphOp),
  seq_id: z.number().optional(),
  meta: z.object({
    truncated: z.boolean().optional(),
    total_hidden: z.number().optional(),
  }).optional(),
});

// --- Configuration (Schema-driven) ---
export const ConfigField = z.object({
  type: z.enum(['slider', 'dropdown', 'text', 'toggle']),
  label: z.string(),
  value: z.any(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
});
export const ConfigSchemaMsg = z.object({
  type: z.literal('config.schema'),
  data: z.record(z.string(), ConfigField),
});
export const ConfigSetMsg = z.object({
  type: z.literal('config.set'),
  key: z.string(),
  value: z.any(),
});

// --- Synchronization (Reconnection Handshake) ---
export const SyncRequest = z.object({
  type: z.literal('sync.request'),
  last_seq_id: z.number().nullable(),
});
export const StateSnapshot = z.object({
  type: z.literal('state.snapshot'),
  seq_id: z.number(),
  data: z.object({
    graph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
    working_memory: z.array(z.any()),
    config: z.record(z.string(), ConfigField),
  }),
});
export const SeqAck = z.object({
  type: z.literal('seq.ack'),
  seq_id: z.number(),
});

// --- Telemetry ---
export const TelemetryMsg = z.object({
  type: z.literal('telemetry'),
  ts: z.number(),
  metrics: z.object({
    reasoning_hz: z.number(),
    tokens_per_sec: z.number(),
    memory_mb: z.number(),
    ws_latency_ms: z.number(),
  }),
});

// --- Master union for validation ---
export const IncomingFromClient = z.discriminatedUnion('type', [
  ChatUserMsg, ConfigSetMsg, SyncRequest,
]);
export const IncomingFromServer = z.discriminatedUnion('type', [
  ChatAgentStream, ChatAgentComplete, CognitiveDelta,
  ConfigSchemaMsg, StateSnapshot, SeqAck, TelemetryMsg,
]);

export type IncomingFromClient = z.infer<typeof IncomingFromClient>;
export type IncomingFromServer = z.infer<typeof IncomingFromServer>;
export type GraphOpType = z.infer<typeof GraphOp>;
export type ConfigFieldType = z.infer<typeof ConfigField>;
