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
  ResolvedSampleConfig,
  SampleConfig,
  ScorerName,
  SourceName,
} from './primitives.js';
export {
  PREMISE_FILTER_NAMES,
  PREMISE_SCORER_NAMES,
  PREMISE_SOURCE_NAMES,
  premiseSampleShape,
} from './config.js';
export type { PremiseOverrides, PremiseSampleSpec } from './config.js';

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
  PREMISE_PRIMITIVES,
  PrologResolutionStrategy,
  ResolutionStrategy,
  SampledStrategy,
  SemanticStrategy,
  SwitchingStrategy,
  TermLinkStrategy,
} from './selection-strategies';
export type { PremisePrimitiveSpec } from './selection-strategies.js';
export { createLinkLayerStrategy, LinkLayerStrategy } from './term-link';
export type { Strategy } from '../types';