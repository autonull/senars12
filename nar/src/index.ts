// Core types - exported first
/** Core NAR term + task type definitions. @public */

export type {
  ComponentContext,
  ComponentState,
} from '@senars/util';
// Memory
/** Concept container. @public */
/** Main memory store. @public */
/** Unified AIKR priority bag substrate. @public */
export { PriorityBag } from './bag/index.js';
// Cognitive
/** Counterfactual simulator. @public */
export { runCounterfactual } from './cognitive/index.js';
/** E1 error taxonomy — nar/public error surface. @public */
export {
  ActionGateError,
  BoundaryValidationError,
  BudgetExceeded,
  BudgetGateError,
  BuilderError,
  DigestMismatch,
  GateError,
  PerceptionGateError,
  RewardGateError,
  SchemaInductionError,
  SenarsError,
} from './errors/index.js';
// Imagination Engine (Cognitive Treadmill)
/** Scenario generation, hidden-model oracle, cognitive treadmill. @public */
export {
  CognitiveTreadmill,
  type DegradationCurve,
  type DegradationPoint,
  type GeneratorConfig,
  HiddenModelOracle,
  type HiddenRule,
  type OracleExpectation,
  type Scenario,
  ScenarioGenerator,
  type ScenarioProfile,
  type StressMetrics,
  type TreadmillConfig,
} from './imagination/index.js';
export type {
  ComponentDefinition,
  Definition,
  ValueDefinition,
} from './lifecycle/index.js';
export { BaseComponent, Container } from './lifecycle/index.js';
// LLM Service
/** LLM service + factory/mock. @public */
export { createLMService, createMockLMService, LMService } from './lm/lm-service.js';
/** Bounded hard-negative mining bag (AIKR bag pattern; consumer: NAR). @public */
export { MiningBag } from './lm/system-one/hard-negatives.js';
export type { Episode, EpisodeType, EpisodicMemoryConfig } from './memory/EpisodicMemory.js';
// Episodic Memory
/** Episodic memory store. @public */
export { EpisodicMemory } from './memory/EpisodicMemory.js';
// Phase B (REFACTOR.todo2): episodic memory consolidation as an AIKR process
export type {
  ConsolidationResult,
  EpisodeConsolidatorOptions,
} from './memory/episode-consolidator.js';
/** Episodic memory consolidation process (AIKR bag pattern; consumer: NAR + integrators). @public */
export { EpisodeConsolidator, symbolicSummary } from './memory/episode-consolidator.js';
export type { ConceptTaskType, MemoryConfig } from './memory/index.js';
export { Concept, Memory } from './memory/index.js';
// Phase D (REFACTOR.todo2): bounded AIKR bags for proposals + hard-negative mining
export type { ProposalBagOptions, ProposalCandidate } from './meta/proposal-bag.js';
/** Bounded self-improvement proposal bag (AIKR bag pattern; consumer: SelfMetaGame). @public */
export { ProposalBag } from './meta/proposal-bag.js';
export type { NARConfig, RLFPConfig } from './nar.js';
// Main NAR class
/** The NAR reasoning engine. @public */
export { NAR } from './nar.js';
// Factory for creating NAR instances
/** Kernel construction presets (tests/benches). @public */
export { createBotNAR, createMinimalNAR, createNAR, createTestNAR } from './nar-presets.js';
// NL Translation
/** Natural-language translation schemas. @public */
export * from './nl/schemas.js';
// Reason
export type { Strategy } from './reason/index.js';
// Rules
/** Rule type definitions. @public */
export type { RegisteredRule, RuleFn, RulePattern, RuleResult } from './rules/index.js';
/** Rule registry + indexing. @public */
/** Synchronous rule processor. @public */
/** Standard NAL rule set. @public */
/** Extended NAL rule set. @public */
export {
  createRulePattern,
  loadBuiltinTable,
  NALExtendedRules,
  NALRules,
  RuleIndex,
  RuleProcessor,
  RuleTableStore,
} from './rules/index.js';
// Self-Reasoning (Metacognition)
/** Reasoning about reasoning, architecture driver. @public */
export * from './self/index.js';
// Task
/** Task scheduling/queuing. @public */
export { TaskManager } from './task/index.js';
export type { SerializedStamp } from './terms/impls/Stamp.js';
/** Term temporal stamp. @public */
export { deserializeStamp, observeStampId, Stamp, serializeStamp } from './terms/impls/Stamp.js';
/** Truth-value algebra. @public */
export { isTruthEqual, Truth } from './terms/impls/Truth.js';
// Terms
/** Term construction + (de)serialization helpers. @public */
/** Narsese parser. @public */
/** Term predicate/accessor utilities. @public */
/** Term-to-graph-edge extraction. @public */
export {
  atom,
  atomicSymbols,
  atomKey,
  bareInheritancePair,
  containsSubterm,
  foldTerm,
  getAntecedent,
  getArgs,
  getConsequent,
  getPredicate,
  getSubject,
  getTermArg,
  getTermArgs,
  hasVariable,
  isAtomic,
  isCompound,
  isConjunction,
  isDisjunction,
  isEquivalence,
  isImplication,
  isInheritance,
  isNegation,
  isSimilarity,
  isVariableSymbol,
  mentionsSymbol,
  operationNameOf,
  operationTerm,
  parseTermToEdges,
  readOperationTerm,
  sameKind,
  serializeTerm,
  sharesInheritanceEnd,
  sharesSymbol,
  TermBuilder,
  TermCollection,
  type TermEdge,
  TermMap,
  type TermMapEntry,
  TermParser,
  TermSet,
  termDepth,
  termKey,
  termParser,
  termSize,
  termsEqual,
  visitTerms,
  walkTerms,
} from './terms/index.js';
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
} from './types/core.js';
/** Core builders, task factories, and NAR error hierarchy. @public */
export {
  ConfigurationError,
  createBudget,
  createSecondaryTask,
  createTask,
  DEFAULT_CONFIG,
  err,
  flatMap,
  getOrElse,
  isErr,
  isOk,
  map,
  NARError,
  OperationError,
  ok,
  ToolError,
  unwrapOrThrow,
  ValidationError,
} from './types/core.js';
