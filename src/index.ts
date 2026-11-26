// Core types - exported first
/** Core NAR term + task type definitions. @public */
export type {
  ComponentContext,
  ComponentState,
} from '@senars/types/lifecycle';

// Capability
/** WASI sandbox, path containment, and timeout utilities. @public */
export * from './capability/index';

// Game
/** Cognitive games and arcade harness. @public */
export * from './game/index';

// Resources
/** Resource contracts for bounded containers. @public */
export * from './resources/index';

// Cognitive Parameters
/** Cognitive architecture parameters, validation, and defaults. @public */
export * from './config/cognitive-parameters';

// Strategies
/** Pluggable cognitive strategies (attention, derivation, sampling, premise, LM rule). @public */
export * from './strategies/index';

// Eval
/** Arcade session state, Brier scoring, and harness utilities. @public */
export * from './eval/index';

// Bag (AIKR substrate)
/** Unified AIKR priority bag substrate. @public */
export * from './bag/index';

// State persistence
/** The persisted consistency boundary, readable without starting a NAR. @public */
export { DEFAULT_NAR_STATE_PATH, readPersistedBoundary } from './state/persisted';
// Rewind checkpoints
/** Rewind checkpoints and the partial-restore report (CORE.19 C2.3). @public */
export { CHECKPOINT_RING_CAP, REWIND_BASE_GAPS, type RewindReport } from './state/checkpoint';

// Cognitive
/** Counterfactual simulator. @public */
export { runCounterfactual } from './cognitive/index';

// Errors
/** E1 error taxonomy — nar/public error surface. @public */
export * from './errors/index';

// Imagination Engine (Cognitive Treadmill)
/** Scenario generation, hidden-model oracle, cognitive treadmill. @public */
export * from './imagination/index';

/** The one component lifecycle state machine (`NAR` extends it). @public */
export { BaseComponent } from './agent/Lifecycle';

// Log
/** Event log adapter over LogStore. @public */
export * from './log/index';

// LLM Service
/** LLM service + factory/mock. @public */
export { createLMService, createMockLMService, LMService } from './lm/lm-service';
/** Bounded hard-negative mining bag (AIKR bag pattern; consumer: NAR). @public */
export { MiningBag } from './lm/system-one/hard-negatives';

// Episodic Memory
/** Episodic memory store. @public */
export { EpisodicMemory } from './memory/index';
export type { Episode, EpisodeType, EpisodicMemoryConfig } from './memory/index';

// Phase B (REFACTOR.todo2): episodic memory consolidation as an AIKR process
export type {
  ConsolidationResult,
  EpisodeConsolidatorOptions,
} from './memory/index';
/** Episodic memory consolidation process (AIKR bag pattern; consumer: NAR + integrators). @public */
export { EpisodeConsolidator, symbolicSummary } from './memory/index';

// Memory (core)
export type { ConceptTaskType, MemoryConfig } from './memory/index';
export { Concept, Memory } from './memory/index';

// Phase D (REFACTOR.todo2): bounded AIKR bags for proposals + hard-negative mining
export type { ProposalBagOptions, ProposalCandidate } from './meta/proposal-bag';
/** Bounded self-improvement proposal bag (AIKR bag pattern; consumer: SelfMetaGame). @public */
export { ProposalBag } from './meta/proposal-bag';

// Main NAR class
export type { NARConfig, RLFPConfig, SystemOneConfig } from './nar/config';
/** The NAR reasoning engine. @public */
export { NAR } from './nar/core';
export { NarEventBus } from './types';

// NAR-LM integration
/** NAR with LM capabilities. @public */
export { NARLM } from './nar-lm';

// Factory for creating NAR instances
/** Kernel construction presets (tests/benches). @public */
export { createBotNAR, createMinimalNAR, createNAR, createTestNAR } from './nar-presets';

// Rules
/** Rule registry + indexing. @public */
/** Synchronous rule processor. @public */
/** Standard NAL rule set. @public */
/** Extended NAL rule set. @public */
export * from './rules/index';

// Self-Reasoning (Metacognition)
/** Reasoning about reasoning, architecture driver. @public */
export * from './self/index';

// Task
/** Task scheduling/queuing. @public */
export { TaskManager } from './task/index';

// Terms
/** Term construction + (de)serialization helpers. @public */
/** Narsese parser. @public */
/** Term predicate/accessor utilities. @public */
/** Term-to-graph-edge extraction. @public */
export * from './terms/index';

// Core types
export type {
  AtomicTerm,
  Budget,
  CompoundTerm,
  CoreConfig,
  Hash,
  Source,
  Task,
  TaskType,
  Term,
  TermSymbol,
  TruthType,
} from './types/core';
export type {
  NAREventMap,
  EventMap,
  EventReceiver,
  EventUnsubscribe,
} from './types/events';
export type {
  ConnectionConfig,
  Connection,
  ConnectionDeps,
  ConnectionFactory,
  ConnectionState,
  IOMessage,
  MessageClassification,
  TransportDeps,
} from './types/transport';

/** Core builders, task factories, and NAR error hierarchy. @public */
export {
  ConfigurationError,
  createTaskWeight,
  createSecondaryTask,
  createTask,
  DEFAULT_CONFIG,
  err,
  flatMap,
  getOrElse,
  isErr,
  isOk,
  map,
  OperationError,
  ok,
  ToolError,
  unwrapOrThrow,
  ValidationError,
} from './types/core';

/** The kernel-owned autonomy loop (CORE.19 C5). @public */
export * from './autonomy/index';

/** The neuro-symbolic voice: one formalizer, one validation gate, one explanation (CORE.19 C6). @public */
export * from './nl/index';

/** The drive→meta-goal injection policy — extracted, pure, and off by default (CORE.19 C5.6). @public */
export * from './drives/index';

// Protocol types (for UI compatibility with @senars/core)
export * from './protocol/index';
export type { Agent } from './agent/index';
export type { CognitiveEvent } from './schemas/cognitive-events';

// Utility re-exports
export { isNarsese } from '@senars/util/text';