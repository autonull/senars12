// Strategy system

export type { PremiseConfig, PremiseSelector } from './premise/index.js';
// Premise formation
export { AnalogySelector, DecompositionSelector, TermMatchingSelector } from './premise/index.js';
export type { ReasonerConfig, ReasoningTrace } from './reasoner.js';
// Reasoner
export { Reasoner } from './reasoner.js';

// Strategy implementations
export { createStrategy } from './strategies/base.js';
export {
  AdaptiveStrategy,
  AnalogicalStrategy,
  CompositeStrategy,
  DecompositionStrategy,
  DefaultFormationStrategy,
  GoalDrivenStrategy,
  PrologStrategy,
  ResolutionStrategy,
  SwitchingStrategy,
  TaskMatchStrategy,
  TermLinkStrategy,
} from './strategies/index.js';
export type { Strategy } from './strategy.js';
export { BagStrategy, ExhaustiveStrategy } from './strategy.js';
