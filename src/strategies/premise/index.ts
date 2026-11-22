/**
 * Premise Strategies — One home per strategy type (C20)
 * Premise selection and formation strategies.
 */

// Premise formation utilities
export { samplePremisesFromConfig } from './primitives';
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
} from './primitives';
export {
  PREMISE_FILTER_NAMES,
  PREMISE_SCORER_NAMES,
  PREMISE_SOURCE_NAMES,
  premiseSampleShape,
} from './config';
export type { PremiseOverrides, PremiseSampleSpec } from './config';

// Premise selection strategies
export {
  CompositeStrategy,
  DecompositionStrategy,
  PREMISE_PRIMITIVES,
  PrologResolutionStrategy,
} from './selection-strategies';
export type { PremisePrimitiveSpec } from './selection-strategies';
export { createLinkLayerStrategy, LinkLayerStrategy, TermLinkStrategy } from './term-link';
export type { Strategy } from '../types';
