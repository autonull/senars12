// Types
/** @public Shared cognitive event types and guards used across core, nar, io, and bins. */

/** @public Unified command registry. */
export { CommandRegistry } from './commands/registry.js';
// Commands
/** @public Command system types. */
export type { CommandContext, CommandDefinition, CommandHandler } from './commands/types.js';
// Config
/** @public Shared configuration types, validation, and env mapping. */
export type { ConfigCapability, ConfigEvent, ConfigSchema, ConfigView } from './config/index.js';
/** @public Agent options schema and validator. */
/** @public Standardized SENARS_* env → config path mapping. */
export {
  AgentOptionsValidationError,
  agentOptionsSchema,
  contextOptsSchema,
  parseEnvValue,
  readEnvOverrides,
  SENARS_ENV_MAP,
  validateAgentOptions,
} from './config/index.js';
// Errors
/** @public Discriminated error code union. */
export type { ErrorCode } from './errors/index.js';
/** @public Unified error hierarchy for all SeNARS packages. */
export {
  ConfigError,
  ConfigurationError,
  ConnectionError,
  EngineError,
  OperationError,
  PolicyViolation,
  SenarsError,
  ToolError,
  TransportError,
  ValidationError,
} from './errors/index.js';
/** @public Event bus receiver/unsubscribe contracts. */
export type { EventReceiver, EventUnsubscribe } from './events/event-bus.js';
// Events
/** @public Generic typed event bus runtime. */
export { EventBus } from './events/event-bus.js';
// Memory
/** @public In-memory session manager shared by io and core. */
export {
  abortSession,
  createSession,
  InMemorySessionManager,
} from './memory/in-memory-session-manager.js';
/** @public Agent-facing option and capability types. */
export type {
  AgentOptions,
  BridgeOptions,
  HealthStatus,
  ParsedCommand,
  SkillDefinition,
} from './types/agent.js';
export type {
  CognitiveEvent,
  CognitiveEventBase,
  CognitiveStimulus,
  Context,
  Derivation,
  EngineOrigin,
} from './types/cognitive.js';
/** @public Runtime guards for cognitive event discrimination. */
export { isEventType, isMettaEvent, isNarEvent } from './types/cognitive.js';
/** @public Engine contract and identifiers. */
export type { Engine, EngineId } from './types/engine.js';
/** @public Episodic memory contracts. */
export type {
  Episode,
  EpisodeType,
  EpisodicMemory,
  EpisodicMemoryConfig,
} from './types/episodic-memory.js';
/** @public Typed event emitter contract. */
export type { EventHandler, TypedEventEmitter } from './types/events.js';
/** @public Component lifecycle and observability contracts. */
export type {
  BaseComponent,
  ComponentContext,
  ComponentState,
  LogEntry,
  Logger,
  LoggerConfig,
  LogLevel,
  Metrics,
} from './types/lifecycle.js';
/** @public LM service contract. */
export type {
  LMExecutionStats,
  LMPromptGenerator,
  LMResponseProcessor,
  LMRuleConfig,
  LMRuleStats,
  LMService,
  LMTask,
  LMTaskGenerator,
  MockLMConfig,
} from './types/llm.js';
/** @public Session/memory manager contracts. */
export type { ConversationSession, SessionManager } from './types/memory.js';
/** @public NAR agent contracts. */
export type { NAR, NARConfig } from './types/nar.js';
/** @public Tool contracts. */
export type { Tool, ToolResult } from './types/tools.js';
/** @public Transport/connection contracts shared by io and core. */
export type {
  Connection,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionFactory,
  ConnectionState,
  IOMessage,
  MessageClassification,
  TransportDeps,
} from './types/transport.js';
/** @public Truth value branded types. */
export type { Confidence, Frequency } from './types/truth.js';
/** @public Truth value constructors. */
export { toConfidence, toFrequency } from './types/truth.js';
// Utils
/** @public Assertion helpers. */
export { assertDefined, invariant } from './utils/assert.js';
/** @public ULID id generation. */
export { generateId } from './utils/id.js';
/** @public Serialization contracts for stateful components. */
export type { Serializable, Versioned } from './utils/serialization.js';
/** @public Uniform-contract adapters bridging legacy serialize/deserialize shapes. */
export { asSerializable, factorySerializable, inPlaceSerializable } from './utils/serialization.js';
/** @public Shared utility functions (deduplicated across packages). */
export {
  clamp,
  clamp01,
  compact,
  edgeKey,
  ensureArray,
  errMsg,
  extractTerm,
  generateId as generatePrefixedId,
  isNarsese,
  isNil,
  makeId,
  safeDiv,
  sleep,
  toError,
  wordOverlap,
} from './utils/shared.js';
/** @public Throttle configuration type. */
export type { ThrottleConfig } from './utils/throttle.js';
/** @public Throttle utilities for stream/callback rate control. */
export { createThrottle, Throttle, throttleGenerator } from './utils/throttle.js';
