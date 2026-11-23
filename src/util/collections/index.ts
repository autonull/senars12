/**
 * Bounded buffer and selection primitives shared by every package's
 * bounded logs, bags, and priority ordering.
 */

// Ring buffer and capping
export {
  BoundedRing,
  pushCapped,
  trimCapped,
  takeLast,
  takeFirst,
  collectUpTo,
  shareCount,
  perPart,
  shareOf,
  chunk,
  getOrInsert,
  accumulate,
  incrementCount,
  addToSet,
  removeFromSet,
  lastByKey,
  unique,
  uniqueBy,
  flatUnique,
  removeBy,
  removeLastBy,
} from './ring-buffer';

export type {
  ReadOnlyLookup,
  BoundedContainer,
  KeyedStore,
  KeyedSetStore,
  OverflowPolicy,
  ContainerStats,
} from './ring-buffer';

// Capping utilities (re-exports for convenience)
export {
  pushCapped as pushCappedArray,
  trimCapped as trimCappedArray,
  takeLast as takeLastArray,
  takeFirst as takeFirstArray,
  collectUpTo as collectUpToArray,
  shareOf as shareOfArray,
  shareCount as shareCountArray,
  perPart as perPartArray,
  chunk as chunkArray,
} from './capping';

// Set/Map helpers (aliased exports for backward compatibility)
export {
  addToSet as addToSetMap,
  removeFromSet as removeFromSetMap,
  getOrInsert as getOrInsertMap,
  accumulate as accumulateMap,
  incrementCount as incrementCountMap,
} from './set-map';

// Sorting and ranking
export {
  sortBy,
  rankBy,
  insertByScoreDesc,
  minBy,
  maxBy,
  minScore,
  maxScore,
  victimBy,
} from './sorting';

export type {
  EvictByScore,
  RankOptions,
} from './sorting';

// Grouping and indexing
export {
  groupBy,
  buckets,
  keyedBy,
  indexBy,
  mapToRecord,
  indexMap,
  mapValues,
  entryKey,
} from './grouping';

// Iteration and selection
export {
  joinKey,
  splitKey,
  selectTopN,
  selectByPriority,
  keyedRank,
} from './iteration';

// Statistics
export {
  containerStats,
} from './stats';