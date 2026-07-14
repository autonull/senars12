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

// ReasoningBackend interface
export type { Capability } from './reasoning/Capability.js';
export type {
  ReasoningBackend,
} from './reasoning/ReasoningBackend.js';
export type {
  BackendConfig,
  BackendInput,
  BackendResult,
  BackendOutput,
  BackendHealth,
  BackendSnapshot,
  GraphDelta,
  GraphEdgeData,
  ReasoningContext,
  WorkingMemorySnapshot,
  ToolInvocation,
  ToolDefinition,
} from './reasoning/BackendTypes.js';

// Reasoning Router
export type { RouteStep, Route } from './reasoning/ReasoningRouter.js';
export { ReasoningRouter } from './reasoning/ReasoningRouter.js';

// Agent
export { Agent, type AgentConfig, type AgentHealth, type BackendRegistration } from './Agent.js';

// Bootstrap
export { bootstrapAgent, type BootstrapSeed, DEFAULT_SEED, DEFAULT_BOOTSTRAP_BELIEFS } from './bootstrap.js';
