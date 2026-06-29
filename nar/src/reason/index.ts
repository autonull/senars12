// Strategy system
export type { Strategy } from './strategy.js';
export { BagStrategy, ExhaustiveStrategy } from './strategy.js';

// Reasoner
export { Reasoner } from './reasoner.js';
export type { ReasonerConfig, ReasoningTrace } from './reasoner.js';

// Strategy implementations
export { createStrategy } from './strategies/base.js';
export {
  PrologStrategy,
  ResolutionStrategy,
  GoalDrivenStrategy,
  AnalogicalStrategy,
  TermLinkStrategy,
  TaskMatchStrategy,
  DecompositionStrategy,
  DefaultFormationStrategy,
  CompositeStrategy,
  AdaptiveStrategy,
  SwitchingStrategy,
} from './strategies/index.js';

// Premise formation
export { TermMatchingSelector, DecompositionSelector, AnalogySelector } from './premise/index.js';
export type { PremiseSelector, PremiseConfig } from './premise/index.js';
