// Core types - exported first
/** Core NAR term + task type definitions. @public */
export type {
  Term,
  AtomicTerm,
  CompoundTerm,
  TruthType,
  Source,
  Task,
  TaskType,
  Budget,
  CoreConfig,
  Hash,
  TermSymbol,
} from './types/core.js';

/** Core builders, task factories, and NAR error hierarchy. @public */
export {
  createBudget,
  createTask,
  createSecondaryTask,
  success,
  failure,
  isSuccess,
  isFailure,
  DEFAULT_CONFIG,
  NARError,
  ValidationError,
  ConfigurationError,
  OperationError,
  ToolError,
} from './types/core.js';

/** Term temporal stamp. @public */
export { Stamp } from './terms/stamp.js';

// Terms
/** Term construction + (de)serialization helpers. @public */
export { TermBuilder, freeze, atom, serializeTerm } from './terms/index.js';
/** Truth-value algebra. @public */
export { Truth, isTruthEqual } from './terms/truth.js';
/** Narsese parser. @public */
export { termParser, TermParser } from './terms/index.js';
/** Term predicate/accessor utilities. @public */
export {
  isVariableSymbol,
  isAtomic,
  isCompound,
  getTermArgs,
  getTermArg,
  termsEqual,
  isInheritance,
  isSimilarity,
  isImplication,
  isEquivalence,
  isConjunction,
  isDisjunction,
  isNegation,
  getSubject,
  getPredicate,
  getAntecedent,
  getConsequent,
  getArgs,
  sameKind,
  visitTerms,
  containsSubterm,
  sharesSymbol,
  mentionsSymbol,
} from './terms/index.js';

// Rules
/** Rule type definitions. @public */
export type { RegisteredRule, RulePattern, RuleFn, RuleResult } from './rules/index.js';
/** Rule registry + indexing. @public */
export { RuleRegistry, RuleIndex, createRulePattern } from './rules/index.js';
/** Synchronous rule processor. @public */
export { RuleProcessor } from './rules/index.js';
/** Standard NAL rule set. @public */
export { NALRules } from './rules/index.js';
/** Extended NAL rule set. @public */
export { NALExtendedRules } from './rules/index.js';

// Memory
/** Concept container. @public */
export { Concept } from './memory/index.js';
export type { ConceptTaskType } from './memory/index.js';
/** Priority bags. @public */
export { Bag, BoundedBag } from './memory/index.js';
/** Main memory store. @public */
export { Memory } from './memory/index.js';
export type { MemoryConfig } from './memory/index.js';

// Task
/** Task scheduling/queuing. @public */
export { TaskManager } from './task/index.js';

// Reason
export type { Strategy } from './reason/index.js';
export { BagStrategy, ExhaustiveStrategy } from './reason/index.js';
/** Core reasoner. @public */
export { Reasoner } from './reason/index.js';
export type { ReasonerConfig } from './reason/index.js';

// Main NAR class
/** The NAR reasoning engine. @public */
export { NAR } from './nar.js';
export type { NARConfig, RLFPConfig } from './nar.js';

// Factory for creating NAR instances
/** NAR factory + convenience constructors. @public */
export { SeNARSFactory, createNAR, createMinimalNAR } from './factory.js';
export type { SeNARSOptions, SeNARSConfig } from './factory.js';

// Lifecycle
/** Lifecycle base component. @public */
export { BaseComponent } from './lifecycle/BaseComponent.js';
export type { ComponentState, ComponentContext } from './lifecycle/BaseComponent.js';
/** Dependency-injection container. @public */
export { Container } from './lifecycle/Container.js';
export type { ComponentDefinition, ValueDefinition, Definition } from './lifecycle/Container.js';

// NL Translation
/** Natural-language translation schemas. @public */
export * from './nl/schemas.js';

// Cognitive
/** Cognitive observer + counterfactual simulator. @public */
export { Observer, runCounterfactual } from './cognitive/index.js';
export type { CognitiveState, CognitiveAction, ObserverReport } from './cognitive/index.js';

// LLM Service
/** LLM service + factory/mock. @public */
export { LMService, createLMService, createMockLMService } from './lm/lm-service.js';

// Episodic Memory
/** Episodic memory store. @public */
export { EpisodicMemory } from './memory/EpisodicMemory.js';
export type { Episode, EpisodeType, EpisodicMemoryConfig } from './memory/EpisodicMemory.js';
