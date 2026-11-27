import type { RankOptions } from './iteration';
/**
 * The narrowing a ranker may do around its sort.
 *
 * Each field removes a chained array stage that every caller otherwise spells
 * as its own `.filter().sort().slice()` pipeline.
 */
export { type RankOptions } from './iteration';
/** Ascending copy sorted by a derived numeric key — never mutates the input. */
export declare function sortBy<T>(items: Iterable<T>, score: (item: T) => number): T[];
/**
 * Descending copy ranked by a derived numeric key — never mutates the input.
 *
 * The one descending ranker: the key is computed **once per item** rather than
 * twice per comparison, and ties keep input order because
 * `Array.prototype.sort` is stable — so a caller never has to decorate with an
 * index to reproduce the order it started with.
 */
export declare function rankBy<T>(items: Iterable<T>, score: (item: T) => number, options?: RankOptions<T>): T[];
/**
 * Insert into a descending-sorted list in O(n) — no full re-sort, unlike
 * `push` + `sort`. Ties keep insertion order.
 */
export declare function insertByScoreDesc<T>(items: T[], item: T, score: (item: T) => number): void;
/**
 * Extremum pick over an iterable. `initial`/`initialScore` seed the running
 * best, so callers can carry a floor (e.g. `maxBy(items, score, item, -1)`)
 * through the same single O(n) scan.
 *
 * Takes any iterable rather than an array because the collections these run over
 * are usually a container's own values — a pending-task map, a Q-table row, a
 * concept store — and requiring an array meant `[...map.values()]` at every call
 * site, an allocation per query that the pick itself never needed.
 */
export declare function minBy<T>(items: Iterable<T>, score: (item: T) => number, initial?: T, initialScore?: number): T | undefined;
export declare function maxBy<T>(items: Iterable<T>, score: (item: T) => number, initial?: T, initialScore?: number): T | undefined;
/**
 * Highest `score` over `items`, floored at 0. Single pass over the iterable
 * with no intermediate array and no second evaluation of `score` — `maxBy`
 * returns the winning item instead, which forces callers that only want the
 * number to either re-derive it or copy the collection first.
 *
 * `floor` is the floor the caller carries into the scan, the way `maxBy` takes
 * its seed: a quantity the collection does not contain but the answer cannot be
 * less than (a concept's own priority among its merges, a floor on a score that
 * no observation reached).
 */
export declare function maxScore<T>(items: Iterable<T>, score: (item: T) => number, floor?: number): number;
/**
 * Lowest `score` over `items`, {@link maxScore} read the other way — and unlike
 * it not floored, because a floor of 0 is an assertion about the score while the
 * floor of a *minimum* is nearly always a claim about the collection instead (a
 * board's leftmost column, a phase's start). Empty input answers `+Infinity`,
 * the only number that loses to every real one.
 */
export declare function minScore<T>(items: Iterable<T>, score: (item: T) => number): number;
/**
 * The scoring half of an eviction order: *the live entry with the lowest score loses*.
 *
 * Split from the whole {@link EvictionOrder} because the two halves are not
 * equally portable. `lru` and `fifo` are not scores a container computes — they
 * are a reading of the container's own insertion order, which a `Map` has and a
 * priority-sorted array does not. This half every container can implement, so it
 * is the half the bag, the forgetting policy and the link layers share.
 *
 * Declared here rather than in `bounded-map` because the shared primitive is
 * {@link minBy}, and a policy type next to the map that first spelled it is a
 * type the other containers cannot name without importing the container.
 */
export type EvictByScore<V> = {
    readonly by: (value: V) => number;
};
/**
 * The entry `order` drops out of `live`, or `undefined` when there is nothing to
 * drop. Ties go to the earlier entry, so the caller gets a victim that is stable
 * across runs rather than one that depends on iteration order.
 */
export declare const victimBy: <V>(live: Iterable<V>, order: EvictByScore<V>) => V | undefined;
//# sourceMappingURL=sorting.d.ts.map