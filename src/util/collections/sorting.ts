import type { RankOptions } from './iteration';
import { keyedRank } from './iteration';

/**
 * The narrowing a ranker may do around its sort.
 *
 * Each field removes a chained array stage that every caller otherwise spells
 * as its own `.filter().sort().slice()` pipeline.
 */
export { type RankOptions } from './iteration';

/** Ascending copy sorted by a derived numeric key — never mutates the input. */
export function sortBy<T>(items: Iterable<T>, score: (item: T) => number): T[] {
  return keyedRank(items, score, (a, b) => a - b);
}

/**
 * Descending copy ranked by a derived numeric key — never mutates the input.
 *
 * The one descending ranker: the key is computed **once per item** rather than
 * twice per comparison, and ties keep input order because
 * `Array.prototype.sort` is stable — so a caller never has to decorate with an
 * index to reproduce the order it started with.
 */
export function rankBy<T>(
  items: Iterable<T>,
  score: (item: T) => number,
  options?: RankOptions<T>
): T[] {
  return keyedRank(items, score, (a, b) => b - a, options);
}

/**
 * Insert into a descending-sorted list in O(n) — no full re-sort, unlike
 * `push` + `sort`. Ties keep insertion order.
 */
export function insertByScoreDesc<T>(items: T[], item: T, score: (item: T) => number): void {
  const s = score(item);
  let i = items.length;
  while (i > 0 && score(items[i - 1]!) < s) i--;
  items.splice(i, 0, item);
}

const LOWER = (candidate: number, incumbent: number): boolean => candidate < incumbent;
const HIGHER = (candidate: number, incumbent: number): boolean => candidate > incumbent;

/**
 * The one extremum scan: `better` says which of two scores wins and the seeds say
 * where the scan starts. Returns the winner and its score so the four readers
 * above differ only in the comparator they pass — they had each grown their own
 * copy of the loop, and a fifth (a bounded map's victim pick) a fifth.
 *
 * The result is one record per call rather than per improvement: `minBy` runs
 * inside per-premise selection, so a per-candidate allocation would have bought
 * the deduplication with an allocation on the hottest scan in the tree.
 */
function extremumBy<T>(
  items: Iterable<T>,
  score: (item: T) => number,
  better: (candidate: number, incumbent: number) => boolean,
  initial: T | undefined,
  initialScore: number
): { item: T | undefined; score: number } {
  let item = initial;
  let best = initialScore;
  for (const candidate of items) {
    const value = score(candidate);
    if (better(value, best)) {
      item = candidate;
      best = value;
    }
  }
  return { item, score: best };
}

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
export function minBy<T>(
  items: Iterable<T>,
  score: (item: T) => number,
  initial?: T,
  initialScore = Number.POSITIVE_INFINITY
): T | undefined {
  return extremumBy(items, score, LOWER, initial, initialScore).item;
}

export function maxBy<T>(
  items: Iterable<T>,
  score: (item: T) => number,
  initial?: T,
  initialScore = Number.NEGATIVE_INFINITY
): T | undefined {
  return extremumBy(items, score, HIGHER, initial, initialScore).item;
}

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
export function maxScore<T>(items: Iterable<T>, score: (item: T) => number, floor = 0): number {
  return extremumBy(items, score, HIGHER, undefined, floor).score;
}

/**
 * Lowest `score` over `items`, {@link maxScore} read the other way — and unlike
 * it not floored, because a floor of 0 is an assertion about the score while the
 * floor of a *minimum* is nearly always a claim about the collection instead (a
 * board's leftmost column, a phase's start). Empty input answers `+Infinity`,
 * the only number that loses to every real one.
 */
export function minScore<T>(items: Iterable<T>, score: (item: T) => number): number {
  return extremumBy(items, score, LOWER, undefined, Number.POSITIVE_INFINITY).score;
}

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
export type EvictByScore<V> = { readonly by: (value: V) => number };

/**
 * The entry `order` drops out of `live`, or `undefined` when there is nothing to
 * drop. Ties go to the earlier entry, so the caller gets a victim that is stable
 * across runs rather than one that depends on iteration order.
 */
export const victimBy = <V>(live: Iterable<V>, order: EvictByScore<V>): V | undefined =>
  minBy(live, order.by);