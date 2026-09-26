// Strategy system
export type { PremiseConfig, PremiseSelector } from '../strategies/premise/formation';
export { AnalogySelector, DecompositionSelector, TermMatchingSelector } from '../strategies/premise/formation';
export type { ReasonerConfig, ReasoningTrace } from './reasoner';
// Reasoner
export { Reasoner } from './reasoner';

// Strategy implementations (premise strategies now in strategies/premise/)
export { createStrategy } from './strategies/base';
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
} from '../strategies/premise/selection-strategies';
export type { Strategy } from './strategy';
export { BagStrategy, ExhaustiveStrategy } from './strategy';