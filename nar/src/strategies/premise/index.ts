/**
 * Premise Strategies — One home per strategy type (C20)
 * Premise selection and formation strategies.
 */

// Premise formation utilities
export { samplePremises } from './sample.js';
export type { PremiseFilter, TruthPredicate, SampleConfig } from './sample.js';
export type { ExtendedSampleConfig } from './sample.js';
export { samplePremisesFromConfig } from './sample.js';

// Deprecated: PremiseSelector interface (use Strategy from ../types.js instead)
/** @deprecated Use Strategy from '../types.js' instead. */
export type { PremiseConfig, PremiseSelector } from './formation.js';
/** @deprecated Use Strategy implementations from '../types.js' or '../index.js' instead. */
export { AnalogySelector, DecompositionSelector, TermMatchingSelector } from './formation.js';

// Premise selection strategies
export {
  AdaptiveStrategy,
  AnalogicalStrategy,
  BagStrategy,
  CompositeStrategy,
  DefaultFormationStrategy,
  DecompositionStrategy,
  EmbeddingLinkStrategy,
  ExhaustiveStrategy,
  GoalDrivenStrategy,
  PrologResolutionStrategy,
  ResolutionStrategy,
  SampledStrategy,
  SemanticStrategy,
  SwitchingStrategy,
  TermLinkStrategy,
} from './selection-strategies';
export { createLinkLayerStrategy, LinkLayerStrategy } from './term-link';
export type { Strategy } from '../types';