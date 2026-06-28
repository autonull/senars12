import { z } from 'zod';

// === Chat Messages (also serve as graph nodes) ===
export const ChatMessage = z.object({
  id: z.string(),
  role: z.enum(['user', 'agent', 'system']),
  content: z.string(),
  timestamp: z.number(),
  term: z.string().optional(),
  truth: z.object({ frequency: z.number(), confidence: z.number() }).optional(),
  punctuation: z.enum(['.', '!', '?']).optional(),
  supports: z.array(z.string()),
  contradicts: z.array(z.string()),
  derivesFrom: z.array(z.string()),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

// === Graph Node with lens-encoded visual data ===
export const GraphNodeData = z.object({
  id: z.string(),
  label: z.string(),
  term: z.string().optional(),
  priority: z.number(),
  confidence: z.number(),
  punctuation: z.enum(['.', '!', '?']).optional(),
  nodeType: z.enum(['concept', 'message', 'derivation', 'goal', 'question']),
  lensData: z.object({ score: z.number(), color: z.string(), size: z.number() }).optional(),
});
export type GraphNodeData = z.infer<typeof GraphNodeData>;

// === Graph Operations (Delta) ===
export const GraphOp = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_node'), id: z.string(), data: GraphNodeData }),
  z.object({ action: z.literal('update_node'), id: z.string(), data: GraphNodeData.partial() }),
  z.object({ action: z.literal('remove_node'), id: z.string() }),
  z.object({ action: z.literal('add_edge'), source: z.string(), target: z.string(), data: z.object({ weight: z.number(), type: z.string() }).optional() }),
  z.object({ action: z.literal('remove_edge'), source: z.string(), target: z.string() }),
]);
export type GraphOpType = z.infer<typeof GraphOp>;

// === Lens ===
export const Lens = z.enum(['belief', 'goal', 'contradiction']);
export type Lens = z.infer<typeof Lens>;

// === Cognitive Delta (with lens) ===
export const CognitiveDelta = z.object({
  type: z.literal('cognitive.delta'),
  module: z.enum(['belief_graph', 'working_memory', 'stream_reasoner']),
  seq_id: z.number().optional(),
  lens: Lens.optional(),
  ops: z.array(GraphOp),
  meta: z.object({ truncated: z.boolean().optional(), total_hidden: z.number().optional() }).optional(),
});

// === Chat ===
export const ChatUserMsg = z.object({ type: z.literal('chat.user'), content: z.string().min(1).max(10000) });
export const ChatAgentStream = z.object({ type: z.literal('chat.agent.stream'), delta: z.string() });
export const ChatAgentComplete = z.object({ type: z.literal('chat.agent.complete'), content: z.string(), messageId: z.string().optional() });

// === Configuration ===
export const ConfigField = z.object({
  type: z.enum(['slider', 'dropdown', 'text', 'toggle']),
  label: z.string(), value: z.any(), options: z.array(z.string()).optional(),
  min: z.number().optional(), max: z.number().optional(), step: z.number().optional(),
});
export const ConfigSchemaMsg = z.object({ type: z.literal('config.schema'), data: z.record(z.string(), ConfigField) });
export const ConfigSetMsg = z.object({ type: z.literal('config.set'), key: z.string(), value: z.any() });

// === Synchronization ===
export const SyncRequest = z.object({ type: z.literal('sync.request'), last_seq_id: z.number().nullable() });
export const StateSnapshot = z.object({
  type: z.literal('state.snapshot'), seq_id: z.number(),
  data: z.object({
    graph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
    working_memory: z.array(z.any()), config: z.record(z.string(), ConfigField),
  }),
});
export const SeqAck = z.object({ type: z.literal('seq.ack'), seq_id: z.number() });

// === Telemetry ===
export const TelemetryMsg = z.object({
  type: z.literal('telemetry'), ts: z.number(),
  metrics: z.object({ reasoning_hz: z.number(), tokens_per_sec: z.number(), memory_mb: z.number(), ws_latency_ms: z.number() }),
});

// === Client Commands ===
export const LensSet = z.object({ type: z.literal('lens.set'), lens: Lens });
export const FocusSet = z.object({ type: z.literal('focus.set'), term: z.string() });

// === Master unions ===
export const IncomingFromClient = z.discriminatedUnion('type', [
  ChatUserMsg, ConfigSetMsg, SyncRequest, LensSet, FocusSet,
]);
export const IncomingFromServer = z.discriminatedUnion('type', [
  ChatAgentStream, ChatAgentComplete, CognitiveDelta,
  ConfigSchemaMsg, StateSnapshot, SeqAck, TelemetryMsg,
]);

export type IncomingFromClient = z.infer<typeof IncomingFromClient>;
export type IncomingFromServer = z.infer<typeof IncomingFromServer>;
export type ConfigFieldType = z.infer<typeof ConfigField>;
