// Core types - exported first
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
  Stamp
} from './types/core.js';


export {
  DEFAULT_CONFIG,
  createBudget,
  createTask,
  success,
  failure,
  isSuccess,
  isFailure,
  NARError,
  ValidationError,
  ConfigurationError,
  OperationError
} from './types/core.js';

// Re-export Stamp class from terms
export {Stamp} from './terms/stamp.js';


// Terms
export {TermBuilder, freeze, atom, serializeTerm} from './terms/index.js';
export {Truth, isTruthEqual} from './terms/truth.js';
export {termParser, TermParser} from './terms/index.js';
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

    sameKind
} from './terms/index.js';

// Rules
export type {RegisteredRule, RulePattern, RuleFn, RuleResult} from './rules/index.js';
export {RuleRegistry, RuleIndex, createRulePattern} from './rules/index.js';
export {RuleProcessor} from './rules/index.js';
export {NALRules} from './rules/index.js';
export {NALExtendedRules} from './rules/index.js';

// Memory
export {Concept} from './memory/index.js';
export type {ConceptTaskType} from './memory/index.js';
export {Bag, BoundedBag} from './memory/index.js';
export {Memory} from './memory/index.js';
export type {MemoryConfig} from './memory/index.js';

// Task
export {TaskManager} from './task/index.js';

// Reason
export type {Strategy} from './reason/index.js';
export {BagStrategy, ExhaustiveStrategy} from './reason/index.js';
export {Reasoner} from './reason/index.js';
export type {ReasonerConfig} from './reason/index.js';

// Main NAR class
export {NAR} from './nar.js';
export type {NARConfig, RLFPConfig} from './nar.js';

// Factory for creating NAR instances
export {SeNARSFactory, createNAR, createMinimalNAR} from './factory.js';
export type {SeNARSOptions, SeNARSConfig} from './factory.js';

// Lifecycle
export {BaseComponent} from './lifecycle/BaseComponent.js';
export type {ComponentState, ComponentContext} from './lifecycle/BaseComponent.js';
export {Container} from './lifecycle/Container.js';
export type {ComponentDefinition, ValueDefinition, Definition} from './lifecycle/Container.js';