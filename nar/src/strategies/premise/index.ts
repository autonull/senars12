/**
 * Premise Strategies — One home per strategy type (C20)
 * Premise selection and formation strategies.
 */

// Premise formation utilities
export { samplePremisesFromConfig } from './primitives.js';
export type {
  FilterName,
  FilterSpec,
  LinearWeights,
  PremiseFilter,
  PremiseScorer,
  SampleConfig,
  ScorerName,
  SourceName,
} from './primitives.js';

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