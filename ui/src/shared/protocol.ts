import { z } from 'zod';

// === Chat Messages (also serve as graph nodes) ===
export const ChatMessage = z.object({
  id: z.string(),
  role: z.enum(['user', 'agent', 'system']),
  content: z.string(),
  html: z.string().optional(),
  timestamp: z.number(),
  term: z.string().optional(),
  truth: z.object({ frequency: z.number(), confidence: z.number() }).optional(),
  punctuation: z.enum(['.', '!', '?']).optional(),
  parentId: z.string().nullable(),
  threadRootId: z.string(),
  supports: z.array(z.string()),
  contradicts: z.array(z.string()),
  derivesFrom: z.array(z.string()),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

// === Graph Node with lens-encoded visual data ===
export const GraphNodeData = z.object({
  id: z.string(),
  label: z.string(),
  html: z.string().optional(),
  term: z.string().optional(),
  priority: z.number(),
  confidence: z.number(),
  punctuation: z.enum(['.', '!', '?']).optional(),
  nodeType: z.enum(['message', 'concept', 'derivation', 'goal', 'question', 'config', 'meta']),
  lensData: z.object({ score: z.number(), color: z.string(), size: z.number() }).optional(),
  layout: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    threadIndex: z.number().optional(),
  }).optional(),
});
export type GraphNodeData = z.infer<typeof GraphNodeData>;

// === Graph Operations (Delta) ===
export const GraphOp = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_node'), id: z.string(), data: GraphNodeData }),
  z.object({ action: z.literal('update_node'), id: z.string(), data: GraphNodeData.partial() }),
  z.object({ action: z.literal('remove_node'), id: z.string() }),
  z.object({ action: z.literal('add_edge'), source: z.string(), target: z.string(), data: z.object({ weight: z.number(), type: z.string(), directed: z.boolean() }).optional() }),
  z.object({ action: z.literal('remove_edge'), source: z.string(), target: z.string() }),
]);
export type GraphOp = z.infer<typeof GraphOp>;

// === Lens ===
export const Lens = z.enum(['belief', 'goal', 'contradiction']);
export type Lens = z.infer<typeof Lens>;

// === Cognitive Delta (with lens) ===
export const CognitiveDelta = z.object({
  type: z.literal('cognitive.delta'),
  seqId: z.number(),
  lens: Lens,
  ops: z.array(GraphOp),
  meta: z.object({ truncated: z.boolean().optional(), totalHidden: z.number().optional() }).optional(),
});

// === Chat ===
const ChatUserMsg = z.object({ type: z.literal('chat.user'), content: z.string().min(1).max(10000) });
const ChatAgentStream = z.object({ type: z.literal('chat.agent.stream'), delta: z.string() });
const ChatAgentComplete = z.object({ type: z.literal('chat.agent.complete'), content: z.string(), html: z.string().optional(), messageId: z.string() });

// === Configuration ===
export const ConfigField = z.object({
  type: z.enum(['slider', 'dropdown', 'text', 'toggle']),
  label: z.string(), value: z.any(), options: z.array(z.string()).optional(),
  min: z.number().optional(), max: z.number().optional(), step: z.number().optional(),
  description: z.string().optional(),
  category: z.enum(['llm', 'nars', 'system', 'advanced']).optional(),
  validation: z.object({
    pattern: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
});
const ConfigSchemaMsg = z.object({ type: z.literal('config.schema'), data: z.record(z.string(), ConfigField) });
const ConfigSetMsg = z.object({ type: z.literal('config.set'), key: z.string(), value: z.any() });

// === Synchronization ===
export const SyncRequest = z.object({ type: z.literal('sync.request'), lastSeqId: z.number().nullable() });
const StateSnapshot = z.object({
  type: z.literal('state.snapshot'), seqId: z.number(),
  data: z.object({
    graph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
    workingMemory: z.array(z.any()), config: z.record(z.string(), ConfigField),
  }),
});

const ViewportSet = z.object({ type: z.literal('viewport.set'), x: z.number(), y: z.number(), zoom: z.number() });

const CognitiveMetrics = z.object({
  activeConcepts: z.number(),
  totalConcepts: z.number(),
  derivationsPerSec: z.number(),
  contradictionCount: z.number(),
  workingMemorySize: z.number(),
  goalUrgencyDistribution: z.record(z.string(), z.number()).optional(),
});

const TelemetryMsg = z.object({
  type: z.literal('telemetry'),
  metrics: z.object({
    reasoning_hz: z.number(),
    tokens_per_sec: z.number(),
    memory_mb: z.number(),
    ws_latency_ms: z.number(),
  }),
  cognitive: CognitiveMetrics.optional(),
});

const LensSet = z.object({ type: z.literal('lens.set'), lens: Lens });
const FocusSet = z.object({ type: z.literal('focus.set'), term: z.string() });

export const IncomingFromClient = z.discriminatedUnion('type', [
  ChatUserMsg, ConfigSetMsg, SyncRequest, LensSet, FocusSet, ViewportSet,
]);
export const IncomingFromServer = z.discriminatedUnion('type', [
  ChatAgentStream, ChatAgentComplete, CognitiveDelta,
  ConfigSchemaMsg, StateSnapshot, TelemetryMsg,
]);
export type IncomingFromClient = z.infer<typeof IncomingFromClient>;
export type IncomingFromServer = z.infer<typeof IncomingFromServer>;
export type ConfigFieldType = z.infer<typeof ConfigField>;
export type GraphOpType = z.infer<typeof GraphOp>;