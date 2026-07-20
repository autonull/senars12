/** Primary agent runtime. @public */
export { Agent } from './Agent.js';

/**
 * @deprecated Use `import type { AgentOptions, HealthStatus, SkillDefinition, ParsedCommand, BridgeOptions } from '@senars/util'`
 */
export type {
  AgentOptions,
  HealthStatus,
  SkillDefinition,
  ParsedCommand,
  BridgeOptions,
} from '@senars/util';
/** Cognitive-event → UI-delta projection bridge. @public */
export { AgentBridge, type BridgeEvent, type BridgeDelta } from './AgentBridge.js';
/** Plugin system types. @public */
export type { SenarsPlugin, PluginContext, TransportFactory } from './Plugin.js';
/** Plugin loader + error type. @public */
export { PluginLoader, PluginLoadError, type TransportRegistry } from './PluginLoader.js';
/** Builtin plugin factories. @public */
export {
  createTransportPlugin,
  createLensPlugin,
  createToolPlugin,
  builtinLensPlugins,
} from './plugins/index.js';
/** Policy/guardrail engine. @public */
export { PolicyEngine, type PolicyRule } from './PolicyEngine.js';
/** Working + episodic memory service. @public */
export { MemoryService } from './memory/MemoryService.js';
export type {
  MemoryEntry,
  MemoryQuery,
  Episode,
  JsonlSessionManagerConfig,
  AgentToolDeps,
} from './memory/types.js';

/**
 * @deprecated Will be removed in next major version.
 * Use `import type { ConversationSession, SessionManager } from '@senars/util'` instead.
 */
export type { ConversationSession, SessionManager } from '@senars/util';

/** Session managers. @public */
export {
  InMemorySessionManager,
  JsonlSessionManager,
  createSession,
  abortSession,
} from './memory/SessionManager.js';
/** Base class for reasoning engines. @public */
export { BaseEngine } from './engine/BaseEngine.js';

/**
 * @deprecated Use `import type { Engine, EngineId, CognitiveStimulus, Context, Derivation, ToolResult } from '@senars/util'`
 */
export type {
  Engine,
  EngineId,
  CognitiveStimulus,
  Context,
  Derivation,
  ToolResult,
} from '@senars/util';
/** Tool registry + specs. @public */
export {
  ToolRegistry,
  type ToolSpec,
  type ToolFn,
  type SkillFeedback,
} from './motor/ToolRegistry.js';
/** Feedback store. @public */
export { FeedbackRegistry, type FeedbackEntry } from './feedback/FeedbackRegistry.js';
/** Builtin tools. @public */
export { BUILTIN_TOOLS, registerBuiltinTools, type CmdArgSet } from './motor/builtin-tools.js';
/** Agent tool factory. @public */
export { buildAgentTools } from './motor/buildAgentTools.js';
/** Narrative synthesis cortex. @public */
export {
  LLMCortex,
  type CortexSynthesizeRequest,
  type CortexSynthesizeResponse,
  type PromptBuilder,
} from './cortex/LLMCortex.js';
/** Cortex factory from an LM service. @public */
export { createCortexFromLM } from './cortex/createCortexFromLM.js';
/** Narsese predicate. @public */
export { isNarsese } from './helpers.js';

/** Lifecycle base component. @public */
export { BaseComponent } from './Lifecycle.js';

/**
 * @deprecated Use `import type { ComponentState, ComponentContext, Metrics, EventBus } from '@senars/util'`
 */
export type { ComponentState, ComponentContext, Metrics, EventBus } from '@senars/util';

/**
 * @deprecated Use `import type { CognitiveEvent, CognitiveEventBase, EngineOrigin } from '@senars/util'` and runtime `isNarEvent, isMettaEvent, isEventType` from `@senars/util`
 */
export type { CognitiveEvent, CognitiveEventBase, EngineOrigin } from '@senars/util';
export { isNarEvent, isMettaEvent, isEventType } from '@senars/util';

/**
 * @deprecated Use `import type { Connection, ConnectionState, ConnectionFactory, ConnectionConfig, ConnectionDeps, TransportDeps, IOMessage, MessageClassification } from '@senars/util'`
 */
export type {
  Connection,
  ConnectionState,
  ConnectionFactory,
  ConnectionConfig,
  ConnectionDeps,
  TransportDeps,
  IOMessage,
  MessageClassification,
} from '@senars/util';
/** Transport-level connection error. @public */
export { ConnectionError } from './Transport.js';
/** Model runner types. @public */
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
/** Model runner. @public */
export { ModelRunner } from './ModelRunner.js';
/** Chat service types. @public */
export type {
  ChatContext,
  ChatServiceDeps,
  ChatOptions,
  ChatStreamEvent,
  Tool as ChatTool,
} from './ChatService.js';
/** Chat service factory. @public */
export { createChatService } from './ChatService.js';
/** UI/protocol projection types. @public */
export {
  GraphNodeData,
  GraphNodeDataStrict,
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
} from './protocol/index.js';
/** Protocol enum types. @public */
export type { ConfigFieldType, GraphOpType } from './protocol/index.js';
/** Validated agent options. @public */
export type { ValidatedAgentOptions } from './Options.js';
/** Stats manager. @public */
export { StatsManager } from './StatsManager.js';
/** Knowledge manager. @public */
export { KnowledgeManager } from './KnowledgeManager.js';
/** Human-in-the-loop approval service. @public */
export { ApprovalService } from './ApprovalService.js';
/** Structured logger. @public */
export { Logger, createLogger, defaultLogger } from './Logger.js';
/** In-memory + SQLite event logs. @public */
export { InMemoryEventLog, SqliteEventLog } from './eventlog/index.js';
/**
 * @deprecated Use `import { agentOptionsSchema, validateAgentOptions, AgentOptionsValidationError, contextOptsSchema } from '@senars/util/config'` instead.
 */
export {
  agentOptionsSchema,
  validateAgentOptions,
  AgentOptionsValidationError,
  contextOptsSchema,
} from './Options.js';
export type { AgentStats } from './StatsManager.js';
export type { PendingApproval, ApprovalManager, ApprovalServiceConfig } from './ApprovalService.js';
export type { CognitiveEventSource, ChatCapable } from './CognitiveEventSource.js';
export type { LogLevel, LogEntry, LoggerConfig } from './Logger.js';
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
export {
  ModulationSchema,
  LensSpecSchema,
  BUILTIN_LENS_IDS,
  isBuiltinLens,
  builtinLensSpecs,
  lensSpecToJsonSchema,
} from './lens-schema.js';
export {
  LENS_COLORS_HEX,
  LENS_LABELS,
  CONNECTION_COLORS,
  LENS_DESCRIPTIONS,
  EDGE_TYPES,
  EDGE_LABELS,
  edgeTypeLabel,
  type LensFieldDescriptor,
  LENS_FIELDS,
} from './constants.js';

export type {
  EventLog,
  EventLogConfig,
  EventLogError,
  SqliteEventLogConfig,
} from './eventlog/index.js';
/**
 * @deprecated Use `import type { ConfigView, ConfigEvent, ConfigSchema } from '@senars/util/config'` instead.
 */
export type { ConfigView, ConfigEvent, ConfigSchema } from './config/Config.js';
export { ConfigViewImpl } from './config/ConfigView.js';
