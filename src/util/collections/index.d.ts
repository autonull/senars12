/**
 * Bounded buffer and selection primitives shared by every package's
 * bounded logs, bags, and priority ordering.
 */
export { BoundedRing, pushCapped, trimCapped, takeLast, takeFirst, collectUpTo, shareCount, perPart, shareOf, chunk, } from './ring-buffer';
export { BoundedMap, } from '../bounded-map';
export type { ReadOnlyLookup, BoundedContainer, KeyedStore, KeyedSetStore, OverflowPolicy, } from './ring-buffer';
export type { BoundedMapOptions, } from '../bounded-map';
export { getOrInsert, accumulate, incrementCount, addToSet, removeFromSet, lastByKey, unique, uniqueBy, flatUnique, removeBy, removeLastBy, } from './set-map';
export { sortBy, rankBy, insertByScoreDesc, minBy, maxBy, minScore, maxScore, victimBy, } from './sorting';
export type { EvictByScore, RankOptions, } from './sorting';
export { groupBy, buckets, keyedBy, indexBy, mapToRecord, indexMap, mapValues, entryKey, } from './grouping';
export { joinKey, splitKey, selectTopN, selectByPriority, keyedRank, } from './iteration';
export { containerStats, } from './stats';
export type { ContainerStats } from './stats';
//# sourceMappingURL=index.d.ts.map