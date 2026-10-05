export type {
  CircuitBreakerConfig,
  CircuitBreakerSettings,
  CircuitSnapshot,
  CircuitState,
  TransitionReason,
} from './circuit-breaker.js';
export { CircuitBreaker } from './circuit-breaker.js';
export { DEFAULT_DIVERGENCE_GAP, hasDivergence } from './divergence.js';
export type { NormalizedVector, ReadonlySetLike } from './similarity.js';
export {
  cosine,
  cosineNormalized,
  cosineUnit,
  jaccard,
  l2Normalize,
  normalize,
} from './similarity.js';