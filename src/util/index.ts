// Types
/** @public Shared cognitive event types and guards used across core, nar, io, and bins. */

/** @public Unified command registry. */
export { CommandRegistry } from '../commands/registry';
// Commands
/** @public Command system types. */
export {
  type CommandContext,
  type CommandDefinition,
  type CommandHandler,
  isQuitResult,
  QUIT_SENTINEL,
} from '../commands/types';
// Config
/** @public Shared configuration types, validation, and env mapping. */
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
  PRESSURE,
  readEnvOverrides,
  SchemaValidationError,
  SENARS_ENV_MAP,
  systemOneDefaults,
  systemOneSchema,
  type SystemOneConfig,
} from '../config/index';
// Errors
/** @public Unified error hierarchy for all SeNARS packages. */
export {
  ConfigurationError,
  ConnectionError,
  EngineError,
  OperationError,
  PolicyViolation,
  SenarsError,
  ToolError,
  TransportError,
  ValidationError,
} from '../errors/index';
/** @public Event bus receiver/unsubscribe contracts. */
export type { EventReceiver, EventUnsubscribe } from '../events/types';
// Events
/** @public Generic typed event bus runtime. */
export { EventBus } from '../events/event-bus';
export { ListenerBag } from '../events/listener-bag';
// Bag
/** @public AIKR bag substrate — one implementation, many consumers. */
export type {
  Bag,
  BagItem,
  BagOptions,
  CyclesBudget,
  EvictStrategy,
  Histogram,
  HistogramImpl,
  InternalEntry,
  PressureListener,
  PressureLevel,
  PressureTransition,
  PriorityBag,
  RandomSource,
} from './bag';
/** @public Push-to-async-iterator bridge shared by config views and event logs. */
export { PushQueue } from '../events/push-queue';
/** @public Single-subject fan-out with isolated listeners. */
export { Signal } from '../events/signal';
/** @public Tool feedback observer for unified statistics tracking. */
export {
  DefaultToolFeedbackObserver,
  type SkillFeedback,
  type ToolFeedback,
  type ToolFeedbackObserver,
  toSkillFeedback,
} from '../feedback/ToolFeedbackObserver';
/** @public The monorepo's one logger. */
export {
  createLogger,
  defaultLogger,
  Logger,
  registerLogEnricher,
  silentLogger,
} from './logger';
export type { SessionStoreOptions } from '../memory/in-memory-session-manager';
// Memory
/** @public Bounded session store and the in-memory session manager over it. */
export {
  abortSession,
  createSession,
  InMemorySessionManager,
  SessionStore,
} from '../memory/in-memory-session-manager';
export type { Middleware } from './middleware';
/** @public Unified middleware primitive (REFACTOR.todo4 Phase A). */
export { dispatch } from './middleware';
/** @public Agent-facing option and capability types. */
export type {
  AgentOptions,
  AuthDecision,
  BridgeOptions,
  HealthStatus,
  ParsedCommand,
  SkillDefinition,
} from '../types/agent';
/** @public Health status levels. */
export { HEALTH_STATUSES, type HealthLevel } from './health-status';
/** @public The shared capability risk vocabulary. */
export { CAPABILITY_RISKS, CapabilityRiskSchema, type CapabilityRisk } from './capability-risk';
export type {
  AgentTrace,
  BandDecision,
  ChatOptions,
  CognitiveAxis,
  CognitiveStimulus,
  Context,
  Derivation,
  EgressVerdict,
  GroundednessGate,
  TracedToolCall,
  TraceGrader,
} from '../types/cognitive';
/** @public The vocabularies a cognitive event carries, so the zod boundary in `core`
 *  cannot admit an origin, a band, an axis or a query shape the types do not carry. */
export {
  BANDS,
  BandDecisionSchema,
  bandOrdinal,
  COGNITIVE_AXES,
  CognitiveAxisSchema,
  egressVerdict,
  JUDGMENT_SHAPES,
  JudgmentShapeSchema,
} from './cognitive-schemas';
/** @public Engine origin discriminants. */
export { ENGINE_ORIGINS, type EngineOrigin, PROPOSER_ORIGIN, NAR_ORIGIN } from './origins';
/** @public Engine contract and identifiers. */
export type { Engine, EngineId } from '../types/engine';
/** @public The one tool outcome shape and its two constructors. */
export { toolAttempt, toolError, toolOk } from '../types/engine';
/** @public Episodic memory contracts. */
export type {
  Episode,
  EpisodeFilter,
  EpisodeType,
  EpisodicMemory,
  EpisodicMemoryConfig,
} from '../types/episodic-memory';
export { EPISODE_TYPES } from '../types/episodic-memory';
/** @public Health-report types (O3, TODO20). */
export type { HealthCheckResult, HealthReport } from '../types/health';
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
} from '../types/lifecycle';
/** @public LM service contract. */
export type {
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
} from '../types/llm';
export { CIRCUIT_STATES, LM_TASKS } from '../types/llm';
/** @public Session/memory manager contracts. */
export type {
  ConversationSession,
  HistoryEntry,
  MessageRole,
  SessionManager,
} from '../types/memory';
export { HistoryEntrySchema, MESSAGE_ROLES, MessageRoleSchema } from '../types/memory';
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
} from '../types/tools';
export { objectSpec } from '../types/tools';

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
} from '../types/transport';
/** @public Truth value branded types. */
export type { BeliefTruth, Confidence, Frequency, TermTruth, TruthLike } from '../types/truth';
/** @public Truth value constructors. */
export {
  asBeliefTruth,
  formatNarseseTruth,
  formatTruth,
  parseNarseseTruth,
  parseTruthLiteral,
  serializeTruth,
  stripTruthSuffix,
  toConfidence,
  toFrequency,
  toTermTruth,
} from '../types/truth';
/** @public Truth schemas. */
export { BeliefTruthSchema, TermTruthSchema } from './truth-schema';
/** @public Truth algebra (confidence/weight conversion, weakening). */
export {
  WEIGHT_AT_CERTAINTY,
  confidenceToWeight,
  weightToConfidence,
  weakenConfidence,
} from './truth-algebra';
// Utils
/** @public Assertion helpers. */
export { assertDefined, invariant } from './assert';
/**
 * @public The general-purpose primitives, grouped by domain: clocks and
 * deadlines, argv, bounded buffers, scalar arithmetic, object graphs, digests,
 * text measurement, schema-failure rendering, and error coercion.
 */
export type { Deadline, Debounced, Deferred } from './async';
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
} from './async';
// Bandit substrate
/** @public One `(state, action)` estimate store for every tabular policy. */
export type { ConfidenceCurve, Exploration, QEntry, QUpdate } from './bandit';
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
} from './bandit';
/** @public Bounded map with pluggable eviction order and optional TTL. */
export type { BoundedMapOptions, EvictionOrder } from './bounded-map';
export { BoundedMap } from './bounded-map';
export type { Flags } from './cli';
export { parseFlags } from './cli';
/** @public The one injectable time source; every bounded container and cache takes one. */
export type { Clock } from './clock';
export { fixedClock, systemClock } from './clock';
export type {
  BoundedContainer,
  ContainerStats,
  EvictByScore,
  OverflowPolicy,
  ReadOnlyLookup,
} from './collections';

// Collections
/** @public Bounded FIFO ring buffer; evicting or refusing at capacity. */
export {
  accumulate,
  addToSet,
  BoundedRing,
  buckets,
  chunk,
  collectUpTo,
  containerStats,
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
  victimBy,
} from './collections';
export { formatIssues, type SchemaIssue } from './diagnostics';
/** @public Circuit breaker state machine for provider routing health. */
export type {
  CircuitBreakerConfig,
  CircuitBreakerSettings,
  CircuitSnapshot,
  CircuitState,
  TransitionReason,
} from './circuit-breaker';
export { CircuitBreaker } from './circuit-breaker';
/** @public Config migration utilities. */
export {
  CURRENT_CONFIG_VERSION,
  migrateConfig,
  migrateConfigFile,
  type MigrationOutcome,
} from './config-migrate';
/** @public Frequency divergence detection for contradiction mining. */
export { DEFAULT_DIVERGENCE_GAP, hasDivergence } from './divergence';
/** @public Environment variable validation against declared grammar. */
export { validateEnv, assertValidEnv, type ValidationResult } from './env-validate';
/** @public The registry every component records its teardown in. */
export type { Teardown } from './disposal';
export { DisposalRegistry } from './disposal';
export { degrade, errMsg, toError } from './error';
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
} from './format';
export type { JsonlLoadResult } from './fs';
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
} from './fs';
export { compact, ensureArray, isNil, isPlainObject } from './guards';
export type { DigestInput } from './hash';
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
} from './hash';
/** @public ULID id generation. */
export {
  currentIdCount,
  generateId,
  type IdSource,
  installIdSource,
  makeId,
  primeIdCount,
  sequentialIdSource,
  sortableIdSource,
} from './id';
/** @public Deterministic JSON with sorted object keys — the one serializer behind every cache key and content digest. */
export { extractJsonObject, parseJsonObject, stableKeyOf, stableStringify } from './json';
/** @public Keyed storage by derived identity, and the named registry over it. */
export type { KeyedRegistryOptions } from './keyed-collection';
export {
  KeyedCollection,
  KeyedRegistry,
} from './keyed-collection';
export type { LruCacheOptions } from './lru-cache';
/** @public Bounded recency-ordered cache with optional TTL. */
export { LruCache } from './lru-cache';
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
  roundTo,
  safeDiv,
  retain,
  safeRatio,
  saturationRamp,
  sigmoid,
  softFalloff,
  softmax,
  softmaxWeights,
  softSquash,
  stdDev,
  sumBy,
  toFiniteNumber,
  ucb1,
  variance,
  invTemperature,
} from './numeric';
export { deepEqual, deepFreeze, deepMerge, getNested, setNested, thaw } from './object';
export { extractLastUserMessage } from './prompt';
/** @public The seeded PRNG, weighted sampling, and the deterministic split primitive. */
export {
  ambientRng,
  choice,
  createLCG,
  fillSeededUnitRange,
  holdoutSplit,
  isStatefulRandomSource,
  mulberry32,
  nextInt,
  randomSourceOf,
  rngFrom,
  SeededRNG,
  type SeededStream,
  seededStream,
  type StatefulRandomSource,
  shuffleInPlace,
  type Weighted,
  weightedPick,
  weightedSample,
  weightedSampleBy,
} from './random';
export type { RateLimiterOptions } from './rate-limit';
/** @public Keyed sliding-window rate limiter for transports and guards. */
export { SlidingWindowRateLimiter } from './rate-limit';
export type { Err, Ok, Result } from './result';
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
} from './result';
export type { RetryOptions } from './retry';
// Caching
export { withRetry } from './retry';
/** @public Process signal → graceful shutdown for every binary; returns its own uninstall. */
export { setupGracefulShutdown } from './shutdown';
export { weightedMean } from './stats';
/** @public Vector and set similarity functions (cosine, Jaccard, L2 normalization). */
export type { NormalizedVector, ReadonlySetLike } from './similarity';
export {
  cosine,
  cosineNormalized,
  cosineUnit,
  jaccard,
  l2Normalize,
  normalize,
} from './similarity';
/** @public One tally of attempts, and the bounded per-key series of them. */
export type { CallTally, CallTallySeriesOptions } from './tally';
export { CallTallySeries, createCallTally, recordCall } from './tally';
export {
  appendTextDelta,
  collectText,
  containsFolded,
  escapeRegExp,
  extractTerm,
  filterFolded,
  foldNeedle,
  isNarsese,
  limitList,
  overlapCount,
  splitLines,
  splitWords,
  TERM_SEPARATORS,
  tokenizeWords,
  truncate,
  truncateBytes,
  wordOverlap,
} from './text';
export { NARSESE_ATOM_CHARS } from './alphabet';
/** @public Base registry classes for type-safe registries. */
export { BaseRegistry, IdRegistry, NameRegistry, FunctionRegistry } from './registry';
/** @public Structural unification over an arbitrary term AST (Narsese, MeTTa). */
export type {
  EqualityDialect,
  Substitution as UnifierSubstitution,
  UnifierDialect,
  UnifyOptions,
  VariablePolicy,
} from './unify';
export { structuralEqual, Unifier } from './unify';
/** @public Source-anchored call-site declarations for the seam ledgers. */
export {
  formatWitness,
  type Witness,
  type WitnessList,
  witnessFiles,
  witnessHolds,
} from './witness';
/** @public Append-only ledger with content-addressable entries. */
export {
  BaseLedgerEntrySchema,
  type BaseLedgerEntry,
  type LedgerConfig,
  createLedger,
  Ledger,
} from './ledger';