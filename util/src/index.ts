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
  CACHE_DIR,
  cachePath,
  contextOptsSchema,
  envBool,
  envCsv,
  envFirst,
  envInt,
  envNum,
  envPositive,
  envStr,
  envStrOr,
  isTruthy,
  parseEnvValue,
  parseOrThrow,
  readEnvOverrides,
  SchemaValidationError,
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
/** @public Push-to-async-iterator bridge shared by config views and event logs. */
export { PushQueue } from './events/push-queue.js';
/** @public Single-subject fan-out with isolated listeners. */
export { Signal } from './events/signal.js';
/** @public Tool feedback observer for unified statistics tracking. */
export {
  DefaultToolFeedbackObserver,
  type ToolFeedback,
  type ToolFeedbackObserver,
} from './feedback/ToolFeedbackObserver.js';
/** @public The monorepo's one logger. */
export { createLogger, defaultLogger, Logger, registerLogEnricher } from './logger.js';
export type { SessionStoreOptions } from './memory/in-memory-session-manager.js';
// Memory
/** @public Bounded session store and the in-memory session manager over it. */
export {
  abortSession,
  createSession,
  InMemorySessionManager,
  SessionStore,
} from './memory/in-memory-session-manager.js';
export type { Middleware } from './middleware.js';
/** @public Unified middleware primitive (REFACTOR.todo4 Phase A). */
export { dispatch, passthrough } from './middleware.js';
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
/** @public The one list of event origins; `EngineOrigin` is derived from it. */
/** @public Runtime guards for cognitive event discrimination. */
export { ENGINE_ORIGINS, isEventType, isNarEvent } from './types/cognitive.js';
/** @public Engine contract and identifiers. */
export type { Engine, EngineId } from './types/engine.js';
/** @public The one tool outcome shape and its two constructors. */
export { toolError, toolOk } from './types/engine.js';
/** @public Episodic memory contracts. */
export type {
  Episode,
  EpisodeFilter,
  EpisodeType,
  EpisodicMemory,
  EpisodicMemoryConfig,
} from './types/episodic-memory.js';
/** @public Typed event emitter contract. */
export type { EventHandler, TypedEventEmitter } from './types/events.js';
/** @public Health-report types (O3, TODO20). */
export type { HealthCheckResult, HealthReport } from './types/health.js';
/** @public Component lifecycle and observability contracts. */
export type {
  BaseComponent,
  ComponentContext,
  ComponentState,
  EventPublisher,
  LogEntry,
  LoggerConfig,
  LogLevel,
  Metrics,
  ScopedLogger,
} from './types/lifecycle.js';
/** @public LM service contract. */
export type {
  LMExecutionStats,
  LMGenerateOptions,
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
/** @public NAR agent contracts. @deprecated — re-exported from `@senars/nar`. */
export type { NAR, NARConfig } from './types/nar.js';
/** @public Tool contracts. */
export type { Tool, ToolCapabilities, ToolResult } from './types/tools.js';
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
export type { Confidence, Frequency, TruthLike } from './types/truth.js';
/** @public Truth value constructors. */
export {
  asBeliefTruth,
  BeliefTruthSchema,
  formatNarseseTruth,
  formatTruth,
  parseNarseseTruth,
  parseTruthLiteral,
  serializeTruth,
  toConfidence,
  toFrequency,
} from './types/truth.js';
// Utils
/** @public Assertion helpers. */
export { assertDefined, invariant } from './utils/assert.js';
/**
 * @public The general-purpose primitives, grouped by domain: clocks and
 * deadlines, argv, bounded buffers, scalar arithmetic, object graphs, digests,
 * text measurement, schema-failure rendering, and error coercion.
 */
export {
  boundedSignal,
  monotonicNow,
  raceDeadline,
  sleep,
  stopwatch,
  TimeoutError,
  withTimeout,
} from './utils/async.js';
/** @public Bounded map with pluggable eviction order and optional TTL. */
export type { BoundedMapOptions, EvictionOrder } from './utils/bounded-map.js';
export { BoundedMap } from './utils/bounded-map.js';
export type { Flags } from './utils/cli.js';
export { parseFlags } from './utils/cli.js';
export type { ReadOnlyLookup } from './utils/collections.js';
// Collections
/** @public Drop-oldest bounded ring buffer. */
export {
  addToSet,
  BoundedRing,
  chunk,
  edgeKey,
  getOrInsert,
  incrementCount,
  insertByScoreDesc,
  maxBy,
  maxScore,
  minBy,
  pushCapped,
  selectByPriority,
  selectTopN,
  sortBy,
  sortByDesc,
  trimCapped,
} from './utils/collections.js';
export { formatIssues, type SchemaIssue } from './utils/diagnostics.js';
export { errMsg, toError } from './utils/error.js';
/** @public Percent, divider, and progress-bar formatting for reports and CLI output. */
export { bar, divider, pct, percentile, section, utcDate } from './utils/format.js';
export type { JsonlLoadResult } from './utils/fs.js';
// Filesystem
export {
  appendJsonl,
  appendJsonlAsync,
  containsPath,
  ensureDir,
  ensureDirSync,
  ensureParentDir,
  ensureParentDirSync,
  iterateJsonl,
  parseJsonOr,
  readJsonFile,
  readJsonFileSync,
  readJsonl,
  readJsonlAsync,
  writeJsonFile,
  writeJsonFileSync,
  writeJsonl,
} from './utils/fs.js';
export { compact, ensureArray, isNil, isPlainObject } from './utils/guards.js';
export type { DigestInput } from './utils/hash.js';
// Hashing
/** @public SHA-256 digests for provenance keys, digest pinning, and state hashes. */
export {
  djb2,
  djb2Step,
  fnv1a,
  fnv1aCombine,
  mul32,
  SHA256_PINNED,
  sha256Hex,
  sha256HexParts,
  sha256Prefixed,
  shortSha256Hex,
} from './utils/hash.js';
/** @public ULID id generation. */
export {
  generateId,
  type IdSource,
  installIdSource,
  makeId,
  sequentialIdSource,
  sortableIdSource,
} from './utils/id.js';
export type { LruCacheOptions } from './utils/lru-cache.js';
/** @public Bounded recency-ordered cache with optional TTL. */
export { LruCache } from './utils/lru-cache.js';
export {
  CHARS_PER_TOKEN,
  clamp,
  clamp01,
  estimateTokens,
  mean,
  occupancy,
  pearson,
  roundTo,
  safeDiv,
  sigmoid,
  softmax,
  stdDev,
  ucb1,
  variance,
} from './utils/numeric.js';
export { deepEqual, deepFreeze, deepMerge, getNested, setNested } from './utils/object.js';
export { extractLastUserMessage } from './utils/prompt.js';
export type { RateLimiterOptions } from './utils/rate-limit.js';
/** @public Keyed sliding-window rate limiter for transports and guards. */
export { SlidingWindowRateLimiter } from './utils/rate-limit.js';
export type { RetryOptions } from './utils/retry.js';
// Caching
export { withRetry } from './utils/retry.js';
/** @public Serialization contracts for stateful components. */
export type { Serializable, Versioned } from './utils/serialization.js';
/** @public Uniform-contract adapters bridging legacy serialize/deserialize shapes. */
export {
  asSerializable,
  factorySerializable,
  inPlaceSerializable,
  stableStringify,
} from './utils/serialization.js';
/** @public Process signal → graceful shutdown for every binary. */
export { setupGracefulShutdown } from './utils/shutdown.js';
export { weightedMean } from './utils/stats.js';
export {
  extractTerm,
  isNarsese,
  limitList,
  tokenizeWords,
  truncate,
  truncateBytes,
  wordOverlap,
} from './utils/text.js';
/** @public Structural unification over an arbitrary term AST (Narsese, MeTTa). */
export type {
  Substitution as UnifierSubstitution,
  UnifierDialect,
  UnifyOptions,
} from './utils/unify.js';
export { Unifier } from './utils/unify.js';
