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
export type { SeNARSConfig, SeNARSOptions } from './factory.js';
// Factory for creating NAR instances
/** NAR factory + convenience constructors. @public */
export { createMinimalNAR, createNAR, SeNARSFactory } from './factory.js';
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
export type { Episode, EpisodeType, EpisodicMemoryConfig } from './memory/EpisodicMemory.js';
// Episodic Memory
/** Episodic memory store. @public */
export { EpisodicMemory } from './memory/EpisodicMemory.js';
export type { ConceptTaskType, MemoryConfig } from './memory/index.js';
export { Concept, Memory } from './memory/index.js';
export type { NARConfig, RLFPConfig } from './nar.js';
// Main NAR class
/** The NAR reasoning engine. @public */
export { NAR } from './nar.js';
// NL Translation
/** Natural-language translation schemas. @public */
export * from './nl/schemas.js';
// Reason
export type { ReasonerConfig, Strategy } from './reason/index.js';
/** Core reasoner. @public */
export { BagStrategy, ExhaustiveStrategy, Reasoner } from './reason/index.js';
// Rules
/** Rule type definitions. @public */
export type { RegisteredRule, RuleFn, RulePattern, RuleResult } from './rules/index.js';
/** Rule registry + indexing. @public */
/** Synchronous rule processor. @public */
/** Standard NAL rule set. @public */
/** Extended NAL rule set. @public */
export {
  createRulePattern,
  NALExtendedRules,
  NALRules,
  RuleIndex,
  RuleProcessor,
  RuleRegistry,
} from './rules/index.js';
// Self-Reasoning (Metacognition)
/** Reasoning about reasoning, architecture driver. @public */
export * from './self/index.js';
// Task
/** Task scheduling/queuing. @public */
export { TaskManager } from './task/index.js';
// Terms
/** Term construction + (de)serialization helpers. @public */
/** Narsese parser. @public */
/** Term predicate/accessor utilities. @public */
/** Term-to-graph-edge extraction. @public */
export {
  atom,
  containsSubterm,
  freeze,
  getAntecedent,
  getArgs,
  getConsequent,
  getPredicate,
  getSubject,
  getTermArg,
  getTermArgs,
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
  parseTermToEdges,
  sameKind,
  serializeTerm,
  sharesSymbol,
  TermBuilder,
  type TermEdge,
  TermParser,
  termParser,
  termsEqual,
  visitTerms,
} from './terms/index.js';
export type { SerializedStamp } from './terms/stamp.js';
/** Term temporal stamp. @public */
export { deserializeStamp, observeStampId, Stamp, serializeStamp } from './terms/stamp.js';
/** Truth-value algebra. @public */
export { isTruthEqual, Truth } from './terms/truth.js';
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
  failure,
  isFailure,
  isSuccess,
  NARError,
  OperationError,
  success,
  ToolError,
  ValidationError,
} from './types/core.js';
