export {CircuitBreaker} from './circuit-breaker.js';
export {Throttle, createThrottle} from './throttle.js';
export {WeakCache, createWeakCache} from './weak-cache.js';
export {fnv1a, fnv1aCombine, computeHash} from './hash.js';
export {clamp, safeDiv, deepFreeze, makeId, isNil, ensureArray, average} from './helpers.js';
export {calculatePriorityDistribution} from './distribution.js';
export {jaccard} from './similarity.js';
export {timed} from './timing.js';
export {unique, halfSlice} from './array.js';
export {resolveVariables} from './variables.js';

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);