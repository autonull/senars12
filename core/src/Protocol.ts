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

export const TruthValue = z.object({
  frequency: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});
export type TruthValue = z.infer<typeof TruthValue>;

// --- Multi-Engine Graph Node Data ---

export const NarConceptNode = z.object({
  nodeType: z.literal('nar:concept'),
  term: z.string(),
  priority: z.number(),
  confidence: z.number(),
  truth: TruthValue.optional(),
  isContradiction: z.boolean().optional(),
  occurrenceTime: z.number().optional(),
  goalRelevance: z.number().optional(),
  lensData: z.object({ score: z.number(), color: z.string(), size: z.number() }).optional(),
  layout: z.object({ x: z.number().optional(), y: z.number().optional(), threadIndex: z.number().optional() }).optional(),
});

export const MettaAtomNode = z.object({
  nodeType: z.literal('metta:atom'),
  atom: z.string(),
  type: z.string().optional(),
  space: z.string(),
  lensData: z.object({ score: z.number(), color: z.string(), size: z.number() }).optional(),
  layout: z.object({ x: z.number().optional(), y: z.number().optional() }).optional(),
});

export const MettaSkillNode = z.object({
  nodeType: z.literal('metta:skill'),
  skill: z.string(),
  args: z.array(z.string()),
  result: z.string(),
  durationMs: z.number(),
  lensData: z.object({ score: z.number(), color: z.string(), size: z.number() }).optional(),
  layout: z.object({ x: z.number().optional(), y: z.number().optional() }).optional(),
});

export const GraphNodeData = z.discriminatedUnion('nodeType', [
  NarConceptNode,
  MettaAtomNode,
  MettaSkillNode,
]);
export type GraphNodeData = z.infer<typeof GraphNodeData>;

// --- Agent Capabilities (for UI negotiation) ---

export const AgentCapabilities = z.object({
  engine: z.enum(['nar', 'metta']),
  supports: z.object({
    chat: z.boolean(),
    beliefs: z.boolean(),
    drives: z.boolean(),
    skills: z.boolean(),
    ltm: z.boolean(),
    rlfp: z.boolean(),
    selfReasoning: z.boolean(),
    autonomyLoop: z.boolean(),
  }),
  configSchema: z.record(z.string(), z.any()).optional(),
});
export type AgentCapabilities = z.infer<typeof AgentCapabilities>;

// === Graph Operations (Delta) ===
export const GraphOp = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_node'), id: z.string(), data: GraphNodeData }),
  z.object({ action: z.literal('update_node'), id: z.string(), data: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal('remove_node'), id: z.string() }),
  z.object({
    action: z.literal('add_edge'),
    source: z.string(),
    target: z.string(),
    data: z.object({ weight: z.number(), type: z.string(), directed: z.boolean() }).optional(),
  }),
  z.object({ action: z.literal('remove_edge'), source: z.string(), target: z.string() }),
]);
export type GraphOp = z.infer<typeof GraphOp>;

// === Lens ===
export const Lens = z.string();
export type Lens = z.infer<typeof Lens>;

// === Cognitive Delta ===
export const CognitiveDelta = z.object({
  type: z.literal('cognitive.delta'),
  seqId: z.number(),
  lens: Lens,
  ops: z.array(GraphOp),
  meta: z.object({ truncated: z.boolean().optional(), totalHidden: z.number().optional() }).optional(),
});

// === Chat ===
export const ChatUserMsg = z.object({
  type: z.literal('chat.user'),
  content: z.string().min(1).max(10000),
});
export const ChatAgentStream = z.object({ type: z.literal('chat.agent.stream'), delta: z.string() });
export const ChatAgentComplete = z.object({
  type: z.literal('chat.agent.complete'),
  content: z.string(),
  html: z.string().optional(),
  messageId: z.string(),
});

// === Configuration ===
export const ConfigField = z.object({
  type: z.enum(['slider', 'dropdown', 'text', 'toggle']),
  label: z.string(),
  value: z.any(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  description: z.string().optional(),
  category: z.enum(['llm', 'nars', 'system', 'advanced']).optional(),
  validation: z.object({ pattern: z.string().optional(), min: z.number().optional(), max: z.number().optional() }).optional(),
});
export const ConfigSchemaMsg = z.object({ type: z.literal('config.schema'), data: z.record(z.string(), ConfigField) });
export const ConfigSetMsg = z.object({ type: z.literal('config.set'), key: z.string(), value: z.any() });

// === Synchronization ===
export const SyncRequest = z.object({ type: z.literal('sync.request'), lastSeqId: z.number().nullable() });
export const StateSnapshot = z.object({
  type: z.literal('state.snapshot'),
  seqId: z.number(),
  data: z.object({
    graph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
    workingMemory: z.array(z.any()),
    config: z.record(z.string(), ConfigField),
  }),
});

export const ViewportSet = z.object({ type: z.literal('viewport.set'), x: z.number(), y: z.number(), zoom: z.number() });

export const CognitiveMetrics = z.object({
  activeConcepts: z.number(),
  totalConcepts: z.number(),
  derivationsPerSec: z.number(),
  contradictionCount: z.number(),
  workingMemorySize: z.number(),
  goalUrgencyDistribution: z.record(z.string(), z.number()).optional(),
});

export const TelemetryMsg = z.object({
  type: z.literal('telemetry'),
  metrics: z.object({
    reasoning_hz: z.number(),
    tokens_per_sec: z.number(),
    memory_mb: z.number(),
    ws_latency_ms: z.number(),
  }),
  cognitive: CognitiveMetrics.optional(),
});

export const LensSet = z.object({ type: z.literal('lens.set'), lens: Lens });
export const FocusSet = z.object({ type: z.literal('focus.set'), term: z.string() });

export const ObjectSetMsg = z.object({
  type: z.literal('object.set'),
  kind: z.enum(['node', 'edge']),
  id: z.string(),
  patch: z.object({
    truth: TruthValue.optional(),
    type: z.string().optional(),
    priority: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

export const NodeSetMsg = z.object({
  type: z.literal('node.set'),
  id: z.string(),
  patch: z.object({
    truth: TruthValue.optional(),
    priority: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// === Lens Registry messages ===
export const LensListMsg = z.object({
  type: z.literal('lens.list'),
  lenses: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    modulation: z.any(),
  })),
});

export const LensDefineMsg = z.object({
  type: z.literal('lens.define'),
  lens: z.object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    modulation: z.any(),
  }),
});

export const LensDefinedMsg = z.object({
  type: z.literal('lens.defined'),
  lens: z.object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    modulation: z.any(),
  }),
});

export const LensFieldsMsg = z.object({
  type: z.literal('lens.fields'),
  fields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['number', 'boolean', 'string', 'object']),
  })),
});

export const NodeHistoryRequestMsg = z.object({ type: z.literal('node.history.request'), term: z.string() });

export const NodeHistoryMsg = z.object({
  type: z.literal('node.history'),
  term: z.string(),
  history: z.array(z.object({
    truth: TruthValue,
    stampId: z.string(),
    timestamp: z.number(),
    source: z.enum(['input', 'derivation', 'revision', 'inference']),
  })),
});

export const IncomingFromClient = z.discriminatedUnion('type', [
  ChatUserMsg,
  ConfigSetMsg,
  SyncRequest,
  LensSet,
  FocusSet,
  ViewportSet,
  ObjectSetMsg,
  NodeSetMsg,
  LensDefineMsg,
  NodeHistoryRequestMsg,
]);
export const IncomingFromServer = z.discriminatedUnion('type', [
  ChatAgentStream,
  ChatAgentComplete,
  CognitiveDelta,
  ConfigSchemaMsg,
  StateSnapshot,
  TelemetryMsg,
  LensListMsg,
  LensDefinedMsg,
  LensFieldsMsg,
  NodeHistoryMsg,
]);
export type IncomingFromClient = z.infer<typeof IncomingFromClient>;
export type IncomingFromServer = z.infer<typeof IncomingFromServer>;
export type ConfigFieldType = z.infer<typeof ConfigField>;
export type GraphOpType = z.infer<typeof GraphOp>;
