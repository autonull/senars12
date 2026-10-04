export { CompositeAttention, GoalRelevanceAttention, NullAttentionModel, SimpleAttention, SpreadingActivation } from './attention/index.js';
export { AnytimeDerivation, DefaultDerivation, FocusedDerivation, SampledDerivation } from './derivation/index.js';
export { RuleGraph } from './lm-graph/RuleGraph.js';
export type { RuleGraphOptions } from './lm-graph/RuleGraph.js';
export { AllSelector, DiverseSelector, PrioritySelector, RotationSelector } from './lm-selectors/index.js';
export { DiverseSampling, GoalBiasedSampling, NoveltySampling, PrioritySampling, WindowedRouletteStrategy, createWindowedRouletteStrategy } from './sampling/index.js';

export type {
  AttentionContext,
  AttentionModel,
  ComponentMetadata,
  DerivationContext,
  DerivationStrategy,
  ModelRuleSelectionContext,
  ModelRuleSelector,
  MetricsSummary,
  SamplingStrategy,
  SearchSpace,
  SearchSpaceParam,
  Strategy,
  StrategyType,
} from './types.js';

export type {
  CompositeSpec,
  ConfigSchema,
  ResolutionTier,
  StrategyCatalog,
  StrategyConfig,
  StrategyRegistration,
  StrategyRegistry,
  StrategySpec,
} from './registration.js';
export {
  canonicalJson,
  configDigest,
  configurable,
  configSchema,
  describeSpec,
  fixed,
  isStrategyExpression,
  singleton,
  strategySpecErrors,
} from './registration.js';
