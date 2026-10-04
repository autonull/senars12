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
 * @deprecated Use `import type { ComponentState, ComponentContext, EventBus } from '@senars/util'`
 */
/**
 * @deprecated Use `import type { EngineOrigin } from '@senars/util'` and `CognitiveEvent`, `isNarEvent`, `isEventType` from `@senars/core/schemas`
 */
/**
 * @deprecated Use `import type { Connection, ConnectionState, ConnectionFactory, ConnectionConfig, ConnectionDeps, TransportDeps, IOMessage, MessageClassification } from '@senars/util'`
 */
export type {
  AgentOptions,
  BridgeOptions,
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
  LogEntry,
  LoggerConfig,
  LogLevel,
  MessageClassification,
  ParsedCommand,
  SessionManager,
  SkillDefinition,
  ToolResult,
  TransportDeps,
} from '@senars/util';
/** Leaf primitives re-exported from @senars/util for consumers of the @senars/core root. @public */
/** Structured logger. @public */
export {
  clamp,
  clamp01,
  compact,
  createLogger,
  defaultLogger,
  edgeKey,
  ensureArray,
  errMsg,
  estimateTokens,
  extractTerm,
  generateId,
  isNarsese,
  isNil,
  Logger,
  makeId,
  registerLogEnricher,
  sleep,
  toError,
} from '@senars/util';
/** Validated agent options. @public */
export type { ValidatedAgentOptions } from '@senars/util/config';
export {
  AgentOptionsValidationError,
  agentOptionsSchema,
  contextOptsSchema,
  validateAgentOptions,
} from '@senars/util/config';
export { Agent } from './Agent.js';
/** Cognitive-event → UI-delta projection bridge. @public */
export type {
  ApprovalManager,
  ApprovalManagerOptions,
  ApprovalRequest,
  ApprovalResult,
  ApprovalServiceConfig,
} from './ApprovalService.js';
/** Human-in-the-loop approval service. @public */
export { ApprovalService, InMemoryApprovalManager } from './ApprovalService.js';
/** Chat option and event vocabulary. @public */
export type { ChatOptions, ChatStreamEvent } from './chat.js';
export {
  type BudgetAllocation,
  CognitiveThread,
  type CognitiveThreadOptions,
  createCognitiveThread,
  createRootBudget,
  type JoinResult,
  type SpawnResult,
  type ThreadMessage,
  ThreadPool,
  type ThreadStatus,
} from './cognitive-thread.js';
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
/** Knowledge manager. @public */
/** Lifecycle base component. @public */
export { BaseComponent } from './Lifecycle.js';
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
  LanguageModel,
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
  type JsonlSessionManagerConfig,
} from './memory/SessionManager.js';
export type {
  AgentToolDeps,
  Episode,
  MemoryEntry,
  MemoryQuery,
  PersistableSessionManager,
} from './memory/types.js';
/** The MeTTa seam `nar` consumes and `metta` implements. @public */
export type { MettaPort } from './metta-port.js';
/** Agent tool factory. @public */
export { registerAgentTools } from './motor/buildAgentTools.js';
/** Builtin tools. @public */
export {
  BUILTIN_TOOLS,
  type BuiltinDeps,
  type CmdArgSet,
  createBuiltinTools,
  type PinStore,
  registerBuiltinTools,
} from './motor/builtin-tools.js';
/** Standalone tool-call dispatcher (canonical; `@senars/nar/agent` re-exports). @public */
export {
  type DispatchArtifact,
  type DispatchCall,
  type DispatchContext,
  type DispatchError,
  dispatchToolCalls,
} from './motor/dispatch.js';
/** Tool registry + specs. @public */
export {
  type SkillFeedback,
  type ToolFn,
  ToolRegistry,
  type ToolSpec,
} from './motor/ToolRegistry.js';
/** Workspace sandbox for motor fs tools. @public */
export { WORKSPACE_ROOT, withinWorkspace } from './motor/workspace.js';
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
  CONNECTION_COLORS,
  CognitiveDelta,
  ConfigField,
  EDGE_LABELS,
  EDGE_TYPES,
  edgeTypeLabel,
  GraphNodeData,
  GraphNodeDataStrict,
  GraphOp,
  IncomingFromClient,
  IncomingFromServer,
  LENS_COLORS_HEX,
  LENS_DESCRIPTIONS,
  LENS_FIELDS,
  LENS_LABELS,
  Lens,
  type LensFieldDescriptor,
  MettaAtomNode,
  MettaSkillNode,
  NarConceptNode,
} from './protocol/index.js';
/** The one cognitive event union, and the two runtime guards over it. @public */
export type { CognitiveEvent } from './schemas/cognitive-events.js';
export { isEventType, isNarEvent } from './schemas/cognitive-events.js';
/** Stats manager. @public */
/** Transport-level connection error. @public */
export { ConnectionError } from './Transport.js';
