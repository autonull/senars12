export { Agent, type AgentOptions, type HealthStatus, type SkillDefinition } from './Agent.js';
export { AgentBridge, type BridgeEvent, type BridgeDelta } from './AgentBridge.js';
export type { SenarsPlugin, PluginContext } from './Plugin.js';
export { PolicyEngine, type PolicyRule } from './PolicyEngine.js';
export { MemoryService } from './memory/MemoryService.js';
export type { MemoryEntry, MemoryQuery } from './memory/types.js';

export {
  BaseComponent,
  type ComponentState,
  type ComponentContext,
  type Metrics,
  type EventBus,
} from './Lifecycle.js';
export type { CognitiveEvent, CognitiveEventBase, EngineOrigin } from './CognitiveEvent.js';
export { isNarEvent, isMettaEvent, isEventType } from './CognitiveEvent.js';
export type {
  Connection,
  ConnectionState,
  ConnectionFactory,
  ConnectionConfig,
  ConnectionDeps,
  TransportDeps,
  IOMessage,
  MessageClassification,
} from './Transport.js';
export { ConnectionError } from './Transport.js';
export type {
  ToolCall,
  ToolError,
  ReasoningArtifact,
  ComposedRequest,
  ModelEvent,
  ModelRunResult,
  ModelProvider,
  ModelRunnerDeps,
} from './ModelRunner.js';
export { ModelRunner } from './ModelRunner.js';
export type {
  ChatContext,
  ChatServiceDeps,
  ChatOptions,
  ChatStreamEvent,
  Tool as ChatTool,
} from './ChatService.js';
export { createChatService } from './ChatService.js';
export type { GraphNodeData, ConfigFieldType, GraphOpType, GraphNodeDataStrict } from './Protocol.js';
export {
  GraphOp,
  CognitiveDelta,
  ConfigField,
  AgentCapabilities,
  NarConceptNode,
  MettaAtomNode,
  MettaSkillNode,
  ChatMessage,
  IncomingFromClient,
  IncomingFromServer,
  Lens,
} from './Protocol.js';
export type { ValidatedAgentOptions } from './Options.js';
export {
  agentOptionsSchema,
  validateAgentOptions,
  AgentOptionsValidationError,
  contextOptsSchema,
} from './Options.js';
export type { AgentStats } from './StatsManager.js';
export { StatsManager } from './StatsManager.js';
export { KnowledgeManager } from './KnowledgeManager.js';
export type { PendingApproval, ApprovalManager, ApprovalServiceConfig } from './ApprovalService.js';
export { ApprovalService } from './ApprovalService.js';
export type { CognitiveEventSource, ChatCapable } from './CognitiveEventSource.js';
export type { LogLevel, LogEntry, LoggerConfig } from './Logger.js';
export { Logger, createLogger, defaultLogger } from './Logger.js';
export {
  makeId,
  isNil,
  ensureArray,
  errMsg,
  toError,
  sleep,
  compact,
  clamp,
  clamp01,
  edgeKey,
  generateId,
  extractTerm,
} from './helpers.js';
export type { CommandContext, CommandDefinition, CommandHandler } from './command-types.js';
export type { LensSpec, ModulationSpec, BuiltinLens } from './lens-schema.js';
export { ModulationSchema, LensSpecSchema, BUILTIN_LENS_IDS, isBuiltinLens, builtinLensSpecs, lensSpecToJsonSchema } from './lens-schema.js';
export { LENS_COLORS_HEX, LENS_LABELS, CONNECTION_COLORS, LENS_DESCRIPTIONS, EDGE_TYPES, EDGE_LABELS, edgeTypeLabel, type LensFieldDescriptor, LENS_FIELDS } from './constants.js';

export type { EventLog, EventLogConfig, EventLogError, SqliteEventLogConfig } from './eventlog/index.js';
export { InMemoryEventLog, SqliteEventLog } from './eventlog/index.js';
export type { CognitiveEvent as NewCognitiveEvent } from './events/EventTypes.js';
export { validatePayload, PayloadSchemas } from './events/EventTypes.js';
export { projectGraph, projectChat, projectLens } from './events/Projections.js';
export { projectFact, type UnifiedFact } from './events/FactProjection.js';
export type { Backend, BackendManifest, ToolDefinition } from './backend/Backend.js';
export { EventBackend } from './backend/EventBackend.js';
export { Capability } from './capability/Capability.js';
export { CapabilityRegistryImpl, type CapabilityRegistry } from './capability/CapabilityRegistry.js';
export type { ToolProvider } from './capability/ToolProvider.js';
export type { ConfigView, ConfigEvent, ConfigSchema } from './config/Config.js';
export { ConfigViewImpl } from './config/ConfigView.js';
export { Kernel, type BackendHealth, type KernelMetrics } from './kernel/Kernel.js';
