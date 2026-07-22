// Types
/** @public Shared cognitive event types and guards used across core, nar, io, and bins. */
export type {
  CognitiveEvent,
  CognitiveEventBase,
  EngineOrigin,
  CognitiveStimulus,
  Context,
  Derivation,
} from './types/cognitive.js';
/** @public Runtime guards for cognitive event discrimination. */
export { isNarEvent, isMettaEvent, isEventType } from './types/cognitive.js';
/** @public Engine contract and identifiers. */
export type { Engine, EngineId } from './types/engine.js';
/** @public Transport/connection contracts shared by io and core. */
export type {
  Connection,
  ConnectionState,
  ConnectionConfig,
  ConnectionFactory,
  ConnectionDeps,
  TransportDeps,
  IOMessage,
  MessageClassification,
} from './types/transport.js';
/** @public Component lifecycle and observability contracts. */
export type {
  ComponentState,
  Logger,
  Metrics,
  ComponentContext,
  BaseComponent,
  LogLevel,
  LogEntry,
  LoggerConfig,
} from './types/lifecycle.js';
/** @public Typed event emitter contract. */
export type { TypedEventEmitter, EventHandler } from './types/events.js';
/** @public Agent-facing option and capability types. */
export type {
  ParsedCommand,
  HealthStatus,
  SkillDefinition,
  BridgeOptions,
  AgentOptions,
} from './types/agent.js';
/** @public Truth value branded types. */
export type { Frequency, Confidence } from './types/truth.js';
/** @public Truth value constructors. */
export { toFrequency, toConfidence } from './types/truth.js';
/** @public LM service contract. */
export type {
  LMService,
  LMExecutionStats,
  LMRuleStats,
  LMRuleConfig,
  LMTask,
  LMPromptGenerator,
  LMResponseProcessor,
  LMTaskGenerator,
  MockLMConfig,
} from './types/llm.js';
/** @public Session/memory manager contracts. */
export type { ConversationSession, SessionManager } from './types/memory.js';
/** @public Episodic memory contracts. */
export type {
  Episode,
  EpisodeType,
  EpisodicMemoryConfig,
  EpisodicMemory,
} from './types/episodic-memory.js';
/** @public NAR agent contracts. */
export type { NAR, NARConfig } from './types/nar.js';
/** @public Tool contracts. */
export type { Tool, ToolResult } from './types/tools.js';

// Errors
/** @public Discriminated error code union. */
export type { ErrorCode } from './errors/index.js';
/** @public Unified error hierarchy for all SeNARS packages. */
export {
  SenarsError,
  ToolError,
  EngineError,
  ConfigError,
  TransportError,
  ConnectionError,
  ValidationError,
  ConfigurationError,
  OperationError,
  PolicyViolation,
} from './errors/index.js';

// Utils
/** @public Assertion helpers. */
export { invariant, assertDefined } from './utils/assert.js';
/** @public ULID id generation. */
export { generateId } from './utils/id.js';
/** @public Shared utility functions (deduplicated across packages). */
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
  generateId as generatePrefixedId,
  safeDiv,
  wordOverlap,
  extractTerm,
  isNarsese,
} from './utils/shared.js';
/** @public Serialization contracts for stateful components. */
export type { Serializable, Versioned } from './utils/serialization.js';
/** @public Uniform-contract adapters bridging legacy serialize/deserialize shapes. */
export { asSerializable, inPlaceSerializable, factorySerializable } from './utils/serialization.js';
/** @public Throttle utilities for stream/callback rate control. */
export { Throttle, createThrottle, throttleGenerator } from './utils/throttle.js';
/** @public Throttle configuration type. */
export type { ThrottleConfig } from './utils/throttle.js';

// Commands
/** @public Command system types. */
export type { CommandContext, CommandDefinition, CommandHandler } from './commands/types.js';
/** @public Unified command registry. */
export { CommandRegistry } from './commands/registry.js';

// Events
/** @public Generic typed event bus runtime. */
export { EventBus } from './events/event-bus.js';
/** @public Event bus receiver/unsubscribe contracts. */
export type { EventReceiver, EventUnsubscribe } from './events/event-bus.js';

// Memory
/** @public In-memory session manager shared by io and core. */
export {
  InMemorySessionManager,
  createSession,
  abortSession,
} from './memory/in-memory-session-manager.js';

// Config
/** @public Shared configuration types, validation, and env mapping. */
export type { ConfigSchema, ConfigEvent, ConfigCapability, ConfigView } from './config/index.js';
/** @public Agent options schema and validator. */
export {
  agentOptionsSchema,
  contextOptsSchema,
  validateAgentOptions,
  AgentOptionsValidationError,
} from './config/index.js';
/** @public Standardized SENARS_* env → config path mapping. */
export { SENARS_ENV_MAP, parseEnvValue, readEnvOverrides } from './config/index.js';
