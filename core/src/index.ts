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
export type { Session } from './SessionOrchestrator.js';
export { SessionOrchestrator } from './SessionOrchestrator.js';
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

export type { EventLog, EventLogConfig, EventLogError, InMemoryEventLog } from './eventlog/index.js';
export type { CognitiveEvent as NewCognitiveEvent } from './events/EventTypes.js';
export { validatePayload, PayloadSchemas } from './events/EventTypes.js';
export { projectGraph, projectChat, projectLens } from './events/Projections.js';
export type { Backend, BackendManifest, ToolDefinition } from './backend/Backend.js';
export { Capability } from './capability/Capability.js';
export { CapabilityRegistryImpl, type CapabilityRegistry } from './capability/CapabilityRegistry.js';
export type { ConfigView, ConfigEvent, ConfigSchema } from './config/Config.js';
export { ConfigViewImpl } from './config/ConfigView.js';
export { Kernel } from './kernel/Kernel.js';
