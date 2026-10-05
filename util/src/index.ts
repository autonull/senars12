// Types
/** @public Shared cognitive event types and guards used across core, nar, io, and bins. */

/** @public Unified command registry. */
export { CommandRegistry } from './commands/registry.js';
// Commands
/** @public Command system types. */
export {
  type CommandContext,
  type CommandDefinition,
  type CommandHandler,
  isQuitResult,
  QUIT_SENTINEL,
} from './commands/types.js';
// Config
/** @public Shared configuration types, validation, and env mapping. */
export type { ConfigCapability, ConfigEvent, ConfigSchema, ConfigView } from './config/index.js';
/** @public Agent options schema and validator. */
/** @public Standardized SENARS_* env → config path mapping. */
export {
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
  envSet,
  envStr,
  envStrOr,
  isTruthy,
  parseEnvValue,
  parseOrThrow,
  readEnvOverrides,
  SchemaValidationError,
  SENARS_ENV_MAP,
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
export { ListenerBag } from './events/listener-bag.js';
/** @public Push-to-async-iterator bridge shared by config views and event logs. */
export { PushQueue } from './events/push-queue.js';
/** @public Single-subject fan-out with isolated listeners. */
export { Signal } from './events/signal.js';
/** @public Tool feedback observer for unified statistics tracking. */
export {
  DefaultToolFeedbackObserver,
  type SkillFeedback,
  type ToolFeedback,
  type ToolFeedbackObserver,
  toSkillFeedback,
} from './feedback/ToolFeedbackObserver.js';
/** @public The monorepo's one logger. */
export {
  createLogger,
  defaultLogger,
  Logger,
  registerLogEnricher,
  silentLogger,
} from './logger.js';
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
export { dispatch } from './middleware.js';
/** @public Agent-facing option and capability types. */
export type {
  AgentOptions,
  AuthDecision,
  BridgeOptions,
  HealthLevel,
  HealthStatus,
  ParsedCommand,
  SkillDefinition,
} from './types/agent.js';
export { HEALTH_STATUSES } from './types/agent.js';
export type { CapabilityRisk } from './types/capability.js';
/** @public The shared capability risk vocabulary. */
export { CAPABILITY_RISKS, CapabilityRiskSchema } from './types/capability.js';
export type {
  BandDecision,
  ChatOptions,
  CognitiveAxis,
  CognitiveStimulus,
  Context,
  Derivation,
  EgressVerdict,
  EngineOrigin,
  GroundednessGate,
} from './types/cognitive.js';
/** @public The vocabularies a cognitive event carries, so the zod boundary in `core`
 *  cannot admit an origin, a band, an axis or a query shape the types do not carry. */
export {
  BANDS,
  BandDecisionSchema,
  bandOrdinal,
  COGNITIVE_AXES,
  CognitiveAxisSchema,
  ENGINE_ORIGINS,
  egressVerdict,
  JUDGMENT_SHAPES,
  JudgmentShapeSchema,
} from './types/cognitive.js';
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
export { EPISODE_TYPES } from './types/episodic-memory.js';
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
  ScopedLogger,
} from './types/lifecycle.js';
/** @public LM service contract. */
export type {
  CircuitState,
  LMExecutionStats,
  LMGenerateOptions,
  LMPromptGenerator,
  LMResponseProcessor,
  LMRuleConfig,
  LMService,
  LMTask,
  LMTaskGenerator,
  MockLMConfig,
  ModelRuleStats,
} from './types/llm.js';
export { CIRCUIT_STATES, createLMStats, LM_TASKS, recordLMCall } from './types/llm.js';
/** @public Session/memory manager contracts. */
export type {
  ConversationSession,
  HistoryEntry,
  MessageRole,
  SessionManager,
} from './types/memory.js';
export { HistoryEntrySchema, MESSAGE_ROLES, MessageRoleSchema } from './types/memory.js';
/** @public Tool contracts. */
export type {
  ToolBudget,
  ToolCall,
  ToolCapabilities,
  ToolContext,
  ToolDescriptor,
  ToolFn,
  ToolResult,
  ToolSchema,
  ToolSchemaProperty,
  ToolSpec,
} from './types/tools.js';
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
export type { BeliefTruth, Confidence, Frequency, TermTruth, TruthLike } from './types/truth.js';
/** @public Truth value constructors. */
export {
  asBeliefTruth,
  BeliefTruthSchema,
  confidenceToWeight,
  formatNarseseTruth,
  formatTruth,
  parseNarseseTruth,
  parseTruthLiteral,
  serializeTruth,
  stripTruthSuffix,
  TermTruthSchema,
  toConfidence,
  toFrequency,
  toTermTruth,
  WEIGHT_AT_CERTAINTY,
  weakenConfidence,
  weightToConfidence,
} from './types/truth.js';
// Utils
/** @public Assertion helpers. */
export { assertDefined, invariant } from './utils/assert.js';
/**
 * @public The general-purpose primitives, grouped by domain: clocks and
 * deadlines, argv, bounded buffers, scalar arithmetic, object graphs, digests,
 * text measurement, schema-failure rendering, and error coercion.
 */
export type { Deadline, Debounced, Deferred } from './utils/async.js';
export {
  boundedDeadline,
  boundedFetch,
  deadline,
  debounce,
  deferred,
  drain,
  monotonicNow,
  periodic,
  raceDeadline,
  readBodyBounded,
  readBytesBounded,
  SerialLanes,
  SerialQueue,
  sleep,
  stopwatch,
  TimeoutError,
  TRUNCATION_MARKER,
  withDeadline,
  withTimeout,
} from './utils/async.js';
// Bandit substrate
/** @public One `(state, action)` estimate store for every tabular policy. */
export type { ConfidenceCurve, Exploration, QEntry, QUpdate } from './utils/bandit.js';
export {
  greedy,
  isYoung,
  lerpUpdate,
  meanUpdate,
  QTable,
  rampConfidence,
  UNVISITED,
  ucb,
  visitConfidence,
} from './utils/bandit.js';
/** @public Bounded map with pluggable eviction order and optional TTL. */
export type { BoundedMapOptions, EvictionOrder } from './utils/bounded-map.js';
export { BoundedMap } from './utils/bounded-map.js';
export type { Flags } from './utils/cli.js';
export { parseFlags } from './utils/cli.js';
/** @public The one injectable time source; every bounded container and cache takes one. */
export type { Clock } from './utils/clock.js';
export { fixedClock, systemClock } from './utils/clock.js';
export type { BoundedContainer, OverflowPolicy, ReadOnlyLookup } from './utils/collections.js';

// Collections
/** @public Bounded FIFO ring buffer; evicting or refusing at capacity. */
export {
  accumulate,
  addToSet,
  BoundedRing,
  buckets,
  chunk,
  collectUpTo,
  edgeKey,
  entryKey,
  flatUnique,
  getOrInsert,
  groupBy,
  incrementCount,
  indexBy,
  indexMap,
  insertByScoreDesc,
  joinKey,
  KEY_SEPARATOR,
  keyedBy,
  lastByKey,
  mapToRecord,
  mapValues,
  maxBy,
  maxScore,
  minBy,
  minScore,
  perPart,
  pushCapped,
  type RankOptions,
  rankBy,
  removeBy,
  removeFromSet,
  removeLastBy,
  selectByPriority,
  selectTopN,
  shareCount,
  shareOf,
  sortBy,
  splitKey,
  takeFirst,
  takeLast,
  trimCapped,
  unique,
  uniqueBy,
} from './utils/collections.js';
export { formatIssues, type SchemaIssue } from './utils/diagnostics.js';
/** @public The registry every component records its teardown in. */
export type { Teardown } from './utils/disposal.js';
export { DisposalRegistry } from './utils/disposal.js';
export { degrade, errMsg, toError } from './utils/error.js';
/** @public Percent, divider, and progress-bar formatting for reports and CLI output. */
export {
  bar,
  divider,
  formatBytes,
  formatDuration,
  pct,
  percentile,
  percentiles,
  section,
  utcDate,
} from './utils/format.js';
export type { JsonlLoadResult } from './utils/fs.js';
// Filesystem
export {
  appendJsonl,
  appendJsonlAsync,
  appendJsonlRow,
  appendJsonlRowAsync,
  containsPath,
  ensureDir,
  ensureDirSync,
  ensureParentDir,
  ensureParentDirSync,
  iterateJsonl,
  jsonlPayload,
  parseJsonOr,
  readJsonFile,
  readJsonFileSync,
  readJsonl,
  readJsonlAsync,
  readJsonlWith,
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
  seededStringHash,
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
/** @public Deterministic JSON with sorted object keys — the one serializer behind every cache key and content digest. */
export { extractJsonObject, parseJsonObject, stableStringify } from './utils/json.js';
/** @public Generic keyed collections with derived structural keys. */
export {
  KeyedCollection,
  KeyedMap,
  KeyedSet,
} from './utils/keyed-collection.js';
export type { LruCacheOptions } from './utils/lru-cache.js';
/** @public Bounded recency-ordered cache with optional TTL. */
export { LruCache } from './utils/lru-cache.js';
export {
  anneal,
  CHARS_PER_TOKEN,
  clamp,
  clamp01,
  clampSigned,
  decayCurve,
  estimateTokens,
  finiteOr,
  flooredRatio,
  forget,
  lerp,
  mean,
  meanOf,
  nearlyEqual,
  normalizeToSum,
  occupancy,
  pearson,
  perSecond,
  renormalize,
  retain,
  roundTo,
  safeDiv,
  safeRatio,
  saturationRamp,
  sigmoid,
  softFalloff,
  softmax,
  softSquash,
  stdDev,
  sumBy,
  toFiniteNumber,
  ucb1,
  variance,
} from './utils/numeric.js';
export { deepEqual, deepFreeze, deepMerge, getNested, setNested } from './utils/object.js';
export { extractLastUserMessage } from './utils/prompt.js';
/** @public The seeded PRNG, weighted sampling, and the deterministic split primitive. */
export {
  ambientRng,
  choice,
  createLCG,
  fillSeededUnitRange,
  holdoutSplit,
  mulberry32,
  nextInt,
  type RandomSource,
  rngFrom,
  SeededRNG,
  type SeededStream,
  seededStream,
  shuffleInPlace,
  type Weighted,
  weightedPick,
  weightedSample,
  weightedSampleBy,
} from './utils/random.js';
export type { RateLimiterOptions } from './utils/rate-limit.js';
/** @public Keyed sliding-window rate limiter for transports and guards. */
export { SlidingWindowRateLimiter } from './utils/rate-limit.js';
export type { Err, Ok, Result } from './utils/result.js';
/** @public The fallible-result union, and the folds over it. */
export {
  attempt,
  attemptAsync,
  err,
  flatMap,
  getOrElse,
  isErr,
  isOk,
  map,
  mapErr,
  match,
  ok,
  unwrapOrThrow,
} from './utils/result.js';
export type { RetryOptions } from './utils/retry.js';
// Caching
export { withRetry } from './utils/retry.js';
/** @public Process signal → graceful shutdown for every binary; returns its own uninstall. */
export { setupGracefulShutdown } from './utils/shutdown.js';
export { weightedMean } from './utils/stats.js';
/** @public One tally of attempts, and the bounded per-key series of them. */
export type { CallTally, CallTallySeriesOptions } from './utils/tally.js';
export { CallTallySeries, createCallTally, recordCall } from './utils/tally.js';
export {
  escapeRegExp,
  extractTerm,
  isNarsese,
  limitList,
  NARSESE_ATOM_CHARS,
  overlapCount,
  splitLines,
  splitWords,
  TERM_SEPARATORS,
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
/** @public Source-anchored call-site declarations for the seam ledgers. */
export {
  formatWitness,
  type Witness,
  type WitnessList,
  witnessFiles,
  witnessHolds,
} from './utils/witness.js';
