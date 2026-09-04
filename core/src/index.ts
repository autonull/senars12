/** Primary agent runtime. @public */

/**
 * @deprecated Use `import type { AgentOptions, HealthStatus, SkillDefinition, ParsedCommand, BridgeOptions } from '@senars/util'`
 */
/**
 * @deprecated Will be removed in next major version.
 * Use `import type { ConversationSession, SessionManager } from '@senars/util'` instead.
 */
/**
 * @deprecated Use `import type { Engine, EngineId, CognitiveStimulus, Context, Derivation, ToolResult } from '@senars/util'`
 */
/**
 * @deprecated Use `import type { ComponentState, ComponentContext, Metrics, EventBus } from '@senars/util'`
 */
/**
 * @deprecated Use `import type { CognitiveEvent, CognitiveEventBase, EngineOrigin } from '@senars/util'` and runtime `isNarEvent, isMettaEvent, isEventType` from `@senars/util`
 */
/**
 * @deprecated Use `import type { Connection, ConnectionState, ConnectionFactory, ConnectionConfig, ConnectionDeps, TransportDeps, IOMessage, MessageClassification } from '@senars/util'`
 */
export type {
  AgentOptions,
  BridgeOptions,
  CognitiveEvent,
  CognitiveEventBase,
  CognitiveStimulus,
  ComponentContext,
  ComponentState,
  Connection,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionFactory,
  ConnectionState,
  Context,
  ConversationSession,
  Derivation,
  Engine,
  EngineId,
  EngineOrigin,
  EventBus,
  HealthStatus,
  IOMessage,
  MessageClassification,
  Metrics,
  ParsedCommand,
  SessionManager,
  SkillDefinition,
  ToolResult,
  TransportDeps,
} from '@senars/util';
export { isEventType, isMettaEvent, isNarEvent } from '@senars/util';
export { Agent } from './Agent.js';
/** Cognitive-event → UI-delta projection bridge. @public */
export { AgentBridge, type BridgeDelta, type BridgeEvent } from './AgentBridge.js';
export type { ApprovalManager, ApprovalServiceConfig, PendingApproval } from './ApprovalService.js';
/** Human-in-the-loop approval service. @public */
export { ApprovalService } from './ApprovalService.js';
/** Chat service types. @public */
export type {
  ChatContext,
  ChatOptions,
  ChatServiceDeps,
  ChatStreamEvent,
  Tool as ChatTool,
} from './ChatService.js';
/** Chat service factory. @public */
export { createChatService } from './ChatService.js';
export type { ChatCapable, CognitiveEventSource } from './CognitiveEventSource.js';
export type { CommandContext, CommandDefinition, CommandHandler } from './command-types.js';
/**
 * @deprecated Use `import type { ConfigView, ConfigEvent, ConfigSchema } from '@senars/util/config'` instead.
 */
export type { ConfigEvent, ConfigSchema, ConfigView } from './config/Config.js';
export { ConfigViewImpl } from './config/ConfigView.js';
export {
  CONNECTION_COLORS,
  EDGE_LABELS,
  EDGE_TYPES,
  edgeTypeLabel,
  LENS_COLORS_HEX,
  LENS_DESCRIPTIONS,
  LENS_FIELDS,
  LENS_LABELS,
  type LensFieldDescriptor,
} from './constants.js';
/** Cortex factory from an LM service. @public */
export { createCortexFromLM } from './cortex/createCortexFromLM.js';
/** Narrative synthesis cortex. @public */
export {
  type CortexSynthesizeRequest,
  type CortexSynthesizeResponse,
  LLMCortex,
  type PromptBuilder,
} from './cortex/LLMCortex.js';
/** Base class for reasoning engines. @public */
export { BaseEngine } from './engine/BaseEngine.js';
export type {
  EventLog,
  EventLogConfig,
  EventLogError,
  SqliteEventLogConfig,
} from './eventlog/index.js';
/** In-memory + SQLite event logs. @public */
export { InMemoryEventLog, SqliteEventLog } from './eventlog/index.js';
/** Feedback store. @public */
export { type FeedbackEntry, FeedbackRegistry } from './feedback/FeedbackRegistry.js';
/** Narsese predicate. @public */
export {
  clamp,
  clamp01,
  compact,
  edgeKey,
  ensureArray,
  errMsg,
  extractTerm,
  generateId,
  isNarsese,
  isNil,
  makeId,
  sleep,
  toError,
} from './helpers.js';
/** Knowledge manager. @public */
export { KnowledgeManager } from './KnowledgeManager.js';
/** Lifecycle base component. @public */
export { BaseComponent } from './Lifecycle.js';
export type { LogEntry, LoggerConfig, LogLevel } from './Logger.js';
/** Structured logger. @public */
export { createLogger, defaultLogger, Logger } from './Logger.js';
export type { BuiltinLens, LensSpec, ModulationSpec } from './lens-schema.js';
export {
  BUILTIN_LENS_IDS,
  builtinLensSpecs,
  isBuiltinLens,
  LensSpecSchema,
  lensSpecToJsonSchema,
  ModulationSchema,
} from './lens-schema.js';
/** Model runner types. @public */
export type {
  ComposedRequest,
  ModelEvent,
  ModelProvider,
  ModelRunnerDeps,
  ModelRunResult,
  ReasoningArtifact,
  ToolCall,
  ToolError,
} from './ModelRunner.js';
/** Model runner. @public */
export { ModelRunner } from './ModelRunner.js';
/** Working + episodic memory service. @public */
export { MemoryService } from './memory/MemoryService.js';
/** Session managers. @public */
export {
  abortSession,
  createSession,
  InMemorySessionManager,
  JsonlSessionManager,
} from './memory/SessionManager.js';
export type {
  AgentToolDeps,
  Episode,
  JsonlSessionManagerConfig,
  MemoryEntry,
  MemoryQuery,
  PersistableSessionManager,
} from './memory/types.js';
/** Agent tool factory. @public */
export { buildAgentTools } from './motor/buildAgentTools.js';
/** Builtin tools. @public */
export { BUILTIN_TOOLS, type CmdArgSet, registerBuiltinTools } from './motor/builtin-tools.js';
/** Tool registry + specs. @public */
export {
  type SkillFeedback,
  type ToolFn,
  ToolRegistry,
  type ToolSpec,
} from './motor/ToolRegistry.js';
/** Validated agent options. @public */
export type { ValidatedAgentOptions } from './Options.js';
/**
 * @deprecated Use `import { agentOptionsSchema, validateAgentOptions, AgentOptionsValidationError, contextOptsSchema } from '@senars/util/config'` instead.
 */
export {
  AgentOptionsValidationError,
  agentOptionsSchema,
  contextOptsSchema,
  validateAgentOptions,
} from './Options.js';
/** Plugin system types. @public */
export type { PluginContext, SenarsPlugin, TransportFactory } from './Plugin.js';
/** Plugin loader + error type. @public */
export { PluginLoadError, PluginLoader, type TransportRegistry } from './PluginLoader.js';
/** Policy/guardrail engine. @public */
export { PolicyEngine, type PolicyRule } from './PolicyEngine.js';
/** Builtin plugin factories. @public */
export {
  builtinLensPlugins,
  createLensPlugin,
  createToolPlugin,
  createTransportPlugin,
} from './plugins/index.js';
/** Protocol enum types. @public */
export type { ConfigFieldType, GraphOpType } from './protocol/index.js';
/** UI/protocol projection types. @public */
export {
  AgentCapabilities,
  ChatMessage,
  CognitiveDelta,
  ConfigField,
  GraphNodeData,
  GraphNodeDataStrict,
  GraphOp,
  IncomingFromClient,
  IncomingFromServer,
  Lens,
  MettaAtomNode,
  MettaSkillNode,
  NarConceptNode,
} from './protocol/index.js';
export type { AgentStats } from './StatsManager.js';
/** Stats manager. @public */
export { StatsManager } from './StatsManager.js';
/** Transport-level connection error. @public */
export { ConnectionError } from './Transport.js';
