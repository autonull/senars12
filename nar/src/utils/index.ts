// Pass-through shims: these modules exist only to re-export `@senars/util`, so
// the barrel re-exports them wholesale. Enumerating their names here is how a
// new shared helper silently stops reaching the 19 files that import this barrel.
export { BoundedRing, addToSet, getOrInsert, incrementCount, maxScore, pushCapped, selectByPriority, selectTopN, trimCapped } from './collections.js';
export type { ReadOnlyLookup } from './collections.js';
export { clamp, clamp01, compact, ensureArray, errMsg, isNil, isPlainObject, makeId, safeDiv, sleep, toError, wordOverlap } from './helpers.js';
export { Throttle, createThrottle, throttleGenerator } from './throttle.js';
export type { ThrottleConfig } from './throttle.js';

export { CircuitBreaker, type CircuitBreakerConfig } from './resilience.js';
export type { DigestInput } from '@senars/util';
export { fnv1a, fnv1aCombine, sha256Hex, sha256HexParts, sha256Prefixed, shortSha256Hex } from '@senars/util';
export { mulberry32, shuffleInPlace, weightedSample, weightedSampleBy } from './random.js';
export { appendJsonl, readJsonl, type JsonlLoadResult } from './jsonl.js';
export { jaccard } from './similarity.js';
