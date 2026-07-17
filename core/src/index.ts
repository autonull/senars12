export { Agent } from './Agent.js';

/**
 * @deprecated Use `import type { AgentOptions, HealthStatus, SkillDefinition, ParsedCommand, BridgeOptions } from '@senars/util'`
 */
export type { AgentOptions, HealthStatus, SkillDefinition, ParsedCommand, BridgeOptions } from '@senars/util';
export { AgentBridge, type BridgeEvent, type BridgeDelta } from './AgentBridge.js';
export type { SenarsPlugin, PluginContext, TransportFactory } from './Plugin.js';
export { PluginLoader, PluginLoadError, type TransportRegistry } from './PluginLoader.js';
export {
  createTransportPlugin,
  createLensPlugin,
  createToolPlugin,
  builtinLensPlugins,
} from './plugins/index.js';
export { PolicyEngine, type PolicyRule } from './PolicyEngine.js';
export { MemoryService } from './memory/MemoryService.js';
export type { MemoryEntry, MemoryQuery, Episode, JsonlSessionManagerConfig, AgentToolDeps } from './memory/types.js';

/**
 * @deprecated Will be removed in next major version.
 * Use `import type { ConversationSession, SessionManager } from '@senars/util'` instead.
 */
export type { ConversationSession, SessionManager } from '@senars/util';

export { InMemorySessionManager, JsonlSessionManager, createSession, abortSession } from './memory/SessionManager.js';
export { BaseEngine } from './engine/BaseEngine.js';

/**
 * @deprecated Use `import type { Engine, EngineId, CognitiveStimulus, Context, Derivation, ToolResult } from '@senars/util'`
 */
export type { Engine, EngineId, CognitiveStimulus, Context, Derivation, ToolResult } from '@senars/util';
export { ToolRegistry, type ToolSpec, type ToolFn, type SkillFeedback } from './motor/ToolRegistry.js';
export { FeedbackRegistry, type FeedbackEntry } from './feedback/FeedbackRegistry.js';
export { BUILTIN_TOOLS, registerBuiltinTools, type CmdArgSet } from './motor/builtin-tools.js';
export { buildAgentTools } from './motor/buildAgentTools.js';
export { LLMCortex, type CortexSynthesizeRequest, type CortexSynthesizeResponse, type PromptBuilder } from './cortex/LLMCortex.js';
export { createCortexFromLM } from './cortex/createCortexFromLM.js';
export { isNarsese } from './helpers.js';

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
export type { Connection, ConnectionState, ConnectionFactory, ConnectionConfig, ConnectionDeps, TransportDeps, IOMessage, MessageClassification } from '@senars/util';
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
export type { ConfigView, ConfigEvent, ConfigSchema } from './config/Config.js';
export { ConfigViewImpl } from './config/ConfigView.js';
