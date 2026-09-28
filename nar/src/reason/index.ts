// Strategy system
export type { ReasonerConfig, ReasoningTrace } from './reasoner';
// Reasoner
export { Reasoner } from './reasoner';

// Strategy implementations (premise strategies now in strategies/premise/)
export { createStrategy } from './strategies/base';
export {
  AdaptiveStrategy,
  AnalogicalStrategy,
  BagStrategy,
  CompositeStrategy,
  DecompositionStrategy,
  DefaultFormationStrategy,
  ExhaustiveStrategy,
  GoalDrivenStrategy,
  ResolutionStrategy,
  SampledStrategy,
  SemanticStrategy,
  SwitchingStrategy,
  TermLinkStrategy,
} from '../strategies/premise/selection-strategies';
export type { Strategy } from '../strategies/types';