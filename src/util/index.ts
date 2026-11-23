// Types
/** @public Shared cognitive event types and guards used across core, nar, io, and bins. */

// Commands
/** @public Unified command registry. */
export { CommandRegistry } from '../commands/registry';
// Commands types
/** @public Command system types. */
export * from '../commands/types';

// Config
/** @public Shared configuration types, validation, and env mapping. */
/** @public Standardized SENARS_* env → config path mapping. */
export * from '../config/index';

// Errors
/** @public Unified error hierarchy for all SeNARS packages. */
export * from '../errors/index';

// Events
/** @public Event bus receiver/unsubscribe contracts. */
export type { EventReceiver, EventUnsubscribe } from '../events/types';
// Events runtime
/** @public Generic typed event bus runtime. */
export * from '../events/event-bus';
export * from '../events/listener-bag';
export * from '../events/push-queue';
export * from '../events/signal';

// Bag (AIKR substrate)
/** @public AIKR bag substrate — one implementation, many consumers. */
export * from './bag/index';

// Feedback
/** @public Tool feedback observer for unified statistics tracking. */
export * from '../feedback/ToolFeedbackObserver';

// Logger
/** @public The monorepo's one logger. */
export * from './logger/index';

// Memory (session)
/** @public Bounded session store and the in-memory session manager over it. */
export * from '../memory/in-memory-session-manager';

// Middleware
/** @public Unified middleware primitive (REFACTOR.todo4 Phase A). */
export * from './middleware/index';

// Agent types
/** @public Agent-facing option and capability types. */
export * from '../types/agent';

// Health status
/** @public Health status levels. */
export * from './health-status/index';

// Capability risk
/** @public The shared capability risk vocabulary. */
export * from './capability-risk/index';

// Cognitive types
export * from '../types/cognitive';

// Cognitive schemas
/** @public The vocabularies a cognitive event carries, so the zod boundary in `core`
 *  cannot admit an origin, a band, an axis or a query shape the types do not carry. */
export * from './cognitive-schemas/index';

// Engine origins
/** @public Engine origin discriminants. */
export * from './origins/index';

// Engine contracts
/** @public Engine contract and identifiers. */
export * from '../types/engine';

// Tool outcome
/** @public The one tool outcome shape and its two constructors. */
export * from '../types/engine';

// Episodic memory
/** @public Episodic memory contracts. */
export * from '../types/episodic-memory';

// Health report types
/** @public Health-report types (O3, TODO20). */
export * from '../types/health';

// Lifecycle
/** @public Component lifecycle and observability contracts. */
export * from '../types/lifecycle';

// LM service
/** @public LM service contract. */
export {
  LM_TASKS,
  type LMTask,
  type LMExecutionStats,
  createLMStats,
  recordLMCall,
  type LMGenerateOptions,
  type LMService,
  type ModelRuleStats,
  type LMRuleConfig,
  type LMPromptGenerator,
  type LMResponseProcessor,
  type LMTaskGenerator,
  type MockLMConfig,
} from '../types/llm';

// Session/memory manager
/** @public Session/memory manager contracts. */
export * from '../types/memory';

// Tool contracts
/** @public Tool contracts. */
export * from '../types/tools';

// Transport/connection
/** @public Transport/connection contracts shared by io and core. */
export * from '../types/transport';

// Truth branded types
/** @public Truth value branded types. */
export * from '../types/truth';

// Truth algebra
/** @public Truth algebra (confidence/weight conversion, weakening). */
export * from './truth-algebra/index';

// Truth schema
/** @public Truth schemas. */
export * from './truth-schema/index';

// Assert
/** @public Assertion helpers. */
export * from './assert/index';

// Async primitives
/**
 * @public The general-purpose primitives, grouped by domain: clocks and
 * deadlines, argv, bounded buffers, scalar arithmetic, object graphs, digests,
 * text measurement, schema-failure rendering, and error coercion.
 */
export * from './async/index';

// Bandit substrate
/** @public One `(state, action)` estimate store for every tabular policy. */
export * from './bandit/index';

// Bounded map
/** @public Bounded map with pluggable eviction order and optional TTL. */
export * from './bounded-map/index';

// CLI flags
export * from './cli/index';

// Clock
/** @public The one injectable time source; every bounded container and cache takes one. */
export * from './clock/index';

// Collections
/** @public Bounded FIFO ring buffer; evicting or refusing at capacity. */
export * from './collections/index';

// Diagnostics
export * from './diagnostics/index';

// Circuit breaker
/** @public Circuit breaker state machine for provider routing health. */
export {
  type CircuitBreakerConfig,
  type CircuitBreakerSettings,
  type CircuitSnapshot,
  type TransitionReason,
  CircuitBreaker,
} from './circuit-breaker/index';

// Config migration
/** @public Config migration utilities. */
export * from './config-migrate/index';

// Divergence
/** @public Frequency divergence detection for contradiction mining. */
export * from './divergence/index';

// Env validation
/** @public Environment variable validation against declared grammar. */
export * from './env-validate/index';

// Disposal
/** @public The registry every component records its teardown in. */
export * from './disposal/index';

// Error utilities
export * from './error/index';

// Format
/** @public Percent, divider, and progress-bar formatting for reports and CLI output. */
export * from './format/index';

// Filesystem
/** @public Filesystem utilities. */
export * from './fs/index';

// Guards
export * from './guards/index';

// Hashing
/** @public SHA-256 digests for provenance keys, digest pinning, and state hashes. */
export * from './hash/index';

// ID generation
/** @public ULID id generation. */
export * from './id/index';

// JSON
/** @public Deterministic JSON with sorted object keys — the one serializer behind every cache key and content digest. */
export * from './json/index';

// Keyed collection
/** @public Keyed storage by derived identity, and the named registry over it. */
export * from './keyed-collection/index';

// LRU cache
/** @public Bounded recency-ordered cache with optional TTL. */
export * from './lru-cache/index';

// Numeric
export * from './numeric/index';

// Object
export * from './object/index';

// Prompt
export * from './prompt/index';

// Random
/** @public The seeded PRNG, weighted sampling, and the deterministic split primitive. */
export * from './random/index';

// Rate limit
/** @public Keyed sliding-window rate limiter for transports and guards. */
export * from './rate-limit/index';

// Result
/** @public The fallible-result union, and the folds over it. */
export * from './result/index';

// Retry
/** @public Retry utilities. */
export * from './retry/index';

// Shutdown
/** @public Process signal → graceful shutdown for every binary; returns its own uninstall. */
export * from './shutdown/index';

// Stats
export * from './stats/index';

// Similarity
/** @public Vector and set similarity functions (cosine, Jaccard, L2 normalization). */
export * from './similarity/index';

// Tally
/** @public One tally of attempts, and the bounded per-key series of them. */
export * from './tally/index';

// Text
export * from './text/index';

// Alphabet
export { NARSESE_ATOM_CHARS } from './alphabet';

// Registry
/** @public Base registry classes for type-safe registries. */
export * from './registry/index';

// Unify
/** @public Structural unification over an arbitrary term AST (Narsese, MeTTa). */
export * from './unify/index';

// Witness
/** @public Source-anchored call-site declarations for the seam ledgers. */
export * from './witness/index';

// Ledger
/** @public Append-only ledger with content-addressable entries. */
export * from './ledger/index';