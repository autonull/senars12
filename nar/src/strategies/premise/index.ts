/**
 * Premise Strategies — One home per strategy type (C20)
 * Premise selection and formation strategies.
 */

// Premise formation utilities
export { samplePremises } from './sample.js';
export type { PremiseFilter, TruthPredicate, SampleConfig } from './sample.js';

// Deprecated: PremiseSelector interface (use Strategy from ../types.js instead)
/** @deprecated Use Strategy from '../types.js' instead. */
export type { PremiseConfig, PremiseSelector } from './formation.js';
/** @deprecated Use Strategy implementations from '../types.js' or '../index.js' instead. */
export { AnalogySelector, DecompositionSelector, TermMatchingSelector } from './formation.js';

// Premise selection strategies
export {
  AdaptiveStrategy,
  AnalogicalStrategy,
  CompositeStrategy,
  DefaultFormationStrategy,
  DecompositionStrategy,
  GoalDrivenStrategy,
  PrologResolutionStrategy,
  PrologStrategy,
  ResolutionStrategy,
  SwitchingStrategy,
  TaskMatchStrategy,
  TermLinkStrategy,
} from './selection-strategies';
export { BagStrategy, ExhaustiveStrategy } from '../../reason/strategy';
export type { Strategy } from '../types';