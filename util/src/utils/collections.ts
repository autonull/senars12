/**
 * Bounded buffer and selection primitives shared by every package's
 * bounded logs, bags, and priority ordering.
 */

import { occupancy } from './numeric.js';

/** Fixed-size slices for batched work — the one chunking primitive. */
export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const step = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step) as T[]);
  return out;
};

/** The one edge identity between two term keys. */
export const edgeKey = (source: string, target: string): string => `${source}->${target}`;

/**
 * Composite keys: the join and the split, so a key that is written in two places
 * is parsed in one.
 *
 * A `scope::name` or `action::kind` pair appeared as a template literal at the
 * write and a hand-rolled `split(sep)[i]` at the read, in each case with the
 * separator written out again. Changing the separator then meant finding every
 * reader of every key, and a reader that split on the wrong index got a plausible
 * wrong answer instead of an error. Here the separator and the arity live in one
 * declaration, and {@link splitKey} takes the count so it cannot silently accept
 * a key of the wrong shape. A part must not itself contain the separator — the
 * pair is a split, not a quote, and {@link splitKey} reports the arity it found
 * rather than quietly returning a part with the separator still in it.
 */
export const KEY_SEPARATOR = '::';

export const joinKey = (...parts: readonly string[]): string => parts.join(KEY_SEPARATOR);

/**
 * The `parts` of a key {@link joinKey} wrote. Throws rather than returning
 * `undefined` for a key that was not written that way: a malformed key reaching a
 * consumer is a bug in the writer, and a `undefined` component would travel on as
 * a plausible string.
 */
export const splitKey = (key: string, parts: number): string[] => {
  const split = key.split(KEY_SEPARATOR);
  if (split.length !== parts) {
    throw new Error(`key '${key}' has ${split.length} parts, expected ${parts}`);
  }
  return split;
};

/**
 * The last row per key, in first-appearance order. The dedupe half of every
 * append-only compaction: a later row is a *correction* of the earlier one, so
 * the earlier is the one that goes — which both compactions were asserting while
 * writing the map by hand, one of them also counting the rows it displaced and
 * the other deriving that count a different way.
 */
export const lastByKey = <T>(rows: Iterable<T>, keyOf: (row: T) => string): Map<string, T> => {
  const byKey = new Map<string, T>();
  for (const row of rows) byKey.set(keyOf(row), row);
  return byKey;
};

/**
 * The first `limit` items `accept` admits, and nothing past them.
 *
 * The AIKR read primitive: a scan over an unbounded source that must not become
 * unbounded work, because the cost of a query is not allowed to scale with the
 * size of what it may return. Ten call sites had written the loop —
 * `push` then `if (length >= limit) break` — and the two ways it was wrong were
 * the two ways a hand-written loop is wrong: forgetting the break and scanning
 * the whole source anyway, and `break`ing on the *source* count so a run of
 * rejects could exhaust a large input for a short answer.
 *
 * A `limit` of zero collects nothing, which is the honest reading and the reason
 * this is one function rather than a `break` a caller may or may not reach.
 */
export const collectUpTo = <T, R = T>(
  items: Iterable<T>,
  limit: number,
  accept: (item: T) => R | undefined
): R[] => {
  const out: R[] = [];
  if (limit <= 0) return out;
  for (const item of items) {
    const admitted = accept(item);
    if (admitted !== undefined) {
      out.push(admitted);
      if (out.length >= limit) break;
    }
  }
  return out;
};

/**
 * How many items a share of a pool comes to — the arithmetic behind every
 * bounded slice, sampling window and holdout split, which each re-derived as
 * `max(1, floor(len * fraction))` (or `ceil`) and left the two roundings to
 * disagree across the tree.
 *
 * `floor` is what separates a *share* from *nothing*: a site that must always
 * make progress passes `1` (the default), and a site that must be faithful to a
 * zero share passes `0`.
 */
export const shareCount = (
  population: number,
  fraction: number,
  floor = 1,
  round: (value: number) => number = Math.floor
): number => Math.max(floor, round(population * fraction));

/**
 * {@link shareCount} read backwards — how many items one of `parts` equal shares
 * of `whole` comes to, which is what stratifying a population into bands is.
 *
 * It has to stay a division rather than `shareCount(whole, 1 / parts)`: a
 * non-terminating reciprocal loses the quotient by one at every exact multiple
 * (`98 * (1/49)` is `1.999…`), which is a sampling window silently admitting half
 * of what it was sized for.
 */
export const perPart = (
  whole: number,
  parts: number,
  floor = 1,
  round: (value: number) => number = Math.floor
): number => Math.max(floor, round(whole / parts));

/**
 * The first `fraction` of `items`, at least `count` and never all of them.
 *
 * Pressure relief always wants a *share* of a pool, and every site computed it as
 * `min(size, ceil(size * share))` followed by a slice — which is a cap and a
 * rounding rule, spelled out four times with the rounding left to differ. A share
 * of zero must yield nothing rather than the `count` floor, or a container under
 * no pressure sheds its minimum anyway.
 *
 * `population` is the pool the share is taken of when it is not `items` itself —
 * the case that made every site re-derive the arithmetic: "a tenth of the store",
 * cut from a candidate list that is smaller than the store.
 */
export const shareOf = <T>(
  items: readonly T[],
  fraction: number,
  count: number = 0,
  population: number = items.length
): T[] => {
  const target = Math.min(items.length, shareCount(population, fraction, count, Math.ceil));
  return items.slice(0, Math.max(0, target));
};

/**
 * The read surface every consumer of a keyed container needs and no more —
 * `Map`, `BoundedMap`, and any bounded projection all satisfy it, so a caller
 * that only looks keys up does not have to name a container.
 */
export interface ReadOnlyLookup<K, V> extends Iterable<[K, V]> {
  get(key: K): V | undefined;
  has(key: K): boolean;
}

/**
 * Common interface for all bounded containers — captures the shared operations
 * across `BoundedRing`, `BoundedMap`, `Bag`, and other capacity-limited structures.
 * Enables generic utilities that work with any bounded container.
 */
export interface BoundedContainer<T> {
  /** Hard capacity limit. */
  readonly capacity: number;
  /** Current number of live items. */
  size(): number;
  /** Occupancy ratio in `0..1` — the AIKR pressure signal. */
  pressure(): number;
  /** Remove all items. */
  clear(): void;
}

/**
 * What a bounded store reports about itself. The archive, the link layers, and the
 * statistics port each spelled this triple inline, so a report could not be read
 * without trusting that the writer meant `size` against the same `capacity` the
 * `utilization` was taken over.
 */
export type ContainerStats = { size: number; capacity: number; utilization: number };

/** {@link ContainerStats} from one size reading and one capacity. */
export const containerStats = (size: number, capacity: number): ContainerStats => ({
  size,
  capacity,
  utilization: occupancy(size, capacity),
});

/**
 * The newest `count` items, reading from the end.
 *
 * `slice(-n)` is the idiom for this and its twin `slice(0, n)` is the idiom for
 * the *oldest* `n`. They are the same length, one argument apart, and nothing at
 * the call site says which one is meant — so both were written in production code
 * and a reader could not tell a "most recent" read from a "first found" read
 * without counting the minus sign. The name is the point; `takeFirst` is the
 * other half.
 *
 * `count <= 0` yields nothing, matching {@link collectUpTo} and {@link shareOf}:
 * a limit of zero is a refusal to read, not a request for the whole list.
 */
export const takeLast = <T>(items: readonly T[], count: number): T[] =>
  count <= 0 ? [] : items.slice(Math.max(0, items.length - count));

/** The oldest `count` items — {@link takeLast} read from the other end. */
export const takeFirst = <T>(items: readonly T[], count: number): T[] =>
  count <= 0 ? [] : items.slice(0, count);

/**
 * Drop-oldest push for plain arrays. One `shift()` per overflow — no `splice`
 * reallocation and no cap arithmetic repeated at the call site. Returns the
 * displaced item, which is what a sliding-window caller needs and what every
 * other caller ignores.
 */
export function pushCapped<T>(log: T[], item: T, capacity: number): T | undefined {
  log.push(item);
  return log.length > capacity ? log.shift() : undefined;
}

/**
 * Keep the newest `capacity` entries of a plain array, dropping from the front.
 * Returns how many were dropped, for the callers that report it. The in-place
 * counterpart of {@link takeLast}, for the callers that own the array.
 */
export function trimCapped<T>(log: T[], capacity: number): number {
  const dropped = Math.max(0, log.length - capacity);
  if (dropped > 0) log.splice(0, dropped);
  return dropped;
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

/** Insert into a descending-sorted list in O(n) — no full re-sort, unlike
 *  `push` + `sort`. Ties keep insertion order. */
export function insertByScoreDesc<T>(items: T[], item: T, score: (item: T) => number): void {
  const s = score(item);
  let i = items.length;
  while (i > 0 && score(items[i - 1]!) < s) i--;
  items.splice(i, 0, item);
}

/**
 * The narrowing a ranker may do around its sort.
 *
 * Each field removes a chained array stage that every caller otherwise spells
 * as its own `.filter().sort().slice()` pipeline.
 */
export interface RankOptions<T> {
  /**
   * Drop items before ranking. Receives the already-computed key, so a floor on
   * that key costs no second pass over the source.
   */
  readonly where?: (item: T, key: number) => boolean;
  /**
   * Secondary order for equal keys — the deterministic tie-break a caller needs
   * when the result must not depend on input order. Returning `0` falls back to
   * input order, so a partial tie-break is still stable.
   */
  readonly tiebreak?: (a: T, b: T) => number;
  /** Keep at most this many of the ranked items. */
  readonly limit?: number;
}

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

/** Decorate-sort-undecorate on a derived key — the shape both rankers share. */
const keyedRank = <T>(
  items: Iterable<T>,
  score: (item: T) => number,
  byKey: (a: number, b: number) => number,
  { where, tiebreak, limit }: RankOptions<T> = {}
): T[] => {
  const keyed: Array<{ item: T; key: number }> = [];
  for (const item of items) {
    const key = score(item);
    if (where !== undefined && !where(item, key)) continue;
    keyed.push({ item, key });
  }
  keyed.sort((a, b) => byKey(a.key, b.key) || (tiebreak?.(a.item, b.item) ?? 0));
  const kept = limit === undefined ? keyed : keyed.slice(0, Math.max(0, limit));
  return kept.map(({ item }) => item);
};

/**
 * Top `n` items from an iterable ranked by `score`, descending. Single-pass with
 * a bounded buffer — avoids materializing or sorting the full input.
 *
 * `where` is the caller's own filter, applied during the scan rather than as a
 * `.filter()` ahead of it: the sites that needed one were all reading a
 * container's values and wanted the threshold on the same key the ranking uses,
 * so a pre-filter meant copying the whole source to hand it to this.
 */
export function selectTopN<T>(
  items: Iterable<T>,
  n: number,
  score: (item: T) => number,
  where: (item: T) => boolean = () => true
): T[] {
  return selectBest(items, n, score, HIGHER, where);
}

/**
 * Greedy budget selection over `{ priority, id }` items: highest priority
 * first, ties broken by id, then capped at `budget`. Bounded-buffer selection
 * (O(n·budget) worst case) with the deterministic tie-break applied at insert
 * time, so the result never depends on input order.
 */
export function selectByPriority<T extends { priority: number; id: string }>(
  items: Iterable<T>,
  budget: number,
  eligible: (item: T) => boolean = () => true
): T[] {
  return selectBest(
    items,
    budget,
    (item) => item,
    (a, b) => a.priority > b.priority || (a.priority === b.priority && a.id < b.id),
    eligible
  );
}

/**
 * The one bounded-buffer selection: keep the `n` best keys the scan has seen,
 * held descending, in a buffer that never grows past `n`.
 *
 * `better` is a total order over keys rather than a numeric score, which is what
 * let {@link selectByPriority} become this instead of a second implementation of
 * the same buffer: priority-plus-id cannot be one number, so it had to hand-roll
 * the insert-walk, the evict-worst slot and the final sort, and a fourth caller
 * wanting the same bound would have written a third. `key` is separate from
 * `better` so a numeric ranking still evaluates its score once per item rather
 * than once per comparison.
 *
 * Nothing is materialized or sorted in full, which is the point: this runs over
 * concept stores, Q-table rows and pending-task maps under an AIKR budget.
 */
function selectBest<T, K>(
  items: Iterable<T>,
  n: number,
  key: (item: T) => K,
  better: (candidate: K, incumbent: K) => boolean,
  eligible: (item: T) => boolean
): T[] {
  if (n <= 0) return [];
  const kept: T[] = [];
  const keys: K[] = [];
  for (const item of items) {
    if (!eligible(item)) continue;
    const k = key(item);
    if (kept.length === n) {
      if (!better(k, keys[n - 1]!)) continue;
      kept[n - 1] = item;
      keys[n - 1] = k;
    } else {
      kept.push(item);
      keys.push(k);
    }
    let i = kept.length - 1;
    while (i > 0 && better(k, keys[i - 1]!)) {
      kept[i] = kept[i - 1]!;
      keys[i] = keys[i - 1]!;
      i--;
    }
    kept[i] = item;
    keys[i] = k;
  }
  return kept;
}

/** The get/set surface a keyed store must expose to be lazily populated. */
export interface KeyedStore<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): unknown;
}

/**
 * Lazily-created map entry — the single get-or-create primitive for nested maps.
 *
 * `onInsert` fires only when this call is the one that created the entry, which
 * is the fact a memoizing caller needs and could not get: hand-writing the
 * `get`-then-`set` was the only way to distinguish a hit from a miss, so every
 * site that had to tell them apart carried its own copy of the branch.
 */
export function getOrInsert<K, V>(
  map: KeyedStore<K, V>,
  key: K,
  factory: () => V,
  onInsert?: () => void
): V {
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const created = factory();
  map.set(key, created);
  onInsert?.();
  return created;
}

/**
 * {@link getOrInsert} plus the write-back: read the record under `key`, mint it
 * with `zero` on first use, let `apply` add to it, store it, and hand it back.
 *
 * The running tally that eight subsystems keep — LM spend per provider, per-tier
 * dispatch latency, per-action episode reward, per-key preference score, source
 * reputation, per-concept staleness. Each wrote the same four lines:
 * `get(key) ?? { …zeros }`, mutate two or three counters, `set(key, entry)`. The
 * `??` is the whole risk and it is invisible at a glance: without it a site
 * throws on first contact, with it the branch is one duplicated decision per
 * subsystem and a fifth subsystem writes it wrong.
 *
 * Mutating the record in place rather than storing a rebuilt copy is what makes
 * this an accumulator and not a `map`: the hot callers run once per dispatched
 * query, per inference task and per distilled row, so this allocates nothing per
 * event. It is also why {@link apply} returns nothing — the entry the caller
 * gets back *is* the stored one, so a site that needs the running total after
 * adding to it (a spend compared against its cap) reads it without a third
 * lookup. `A` is constrained to an object for the same reason: a primitive would
 * make every `apply` a silent no-op, which is the one failure this function must
 * not have. A site that wants a fresh record per event rather than a tally uses
 * `map` instead.
 */
export function accumulate<K, A extends object>(
  store: KeyedStore<K, A>,
  key: K,
  zero: () => A,
  apply: (entry: A) => void
): A {
  const existing = store.get(key);
  const entry = existing ?? zero();
  apply(entry);
  store.set(key, entry);
  return entry;
}

/**
 * Bucket `items` by a derived key, preserving encounter order within each
 * bucket. The lazy-bucket-plus-`getOrInsert` pair is the shape every
 * group-by-key site was hand-writing; expressed once, the call site is a single
 * declaration and the bucket type is inferred rather than repeated.
 */
export function groupBy<T, K>(items: Iterable<T>, key: (item: T) => K): Map<K, T[]> {
  const buckets = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = buckets.get(k);
    if (bucket) bucket.push(item);
    else buckets.set(k, [item]);
  }
  return buckets;
}

/**
 * {@link groupBy} without the keys — for the caller that buckets each group but
 * never looks a group up by its key, where keeping the map alive would be a
 * whole index retained for nothing. Each bucket keeps encounter order, so
 * `bucket[0]` is the first item seen for that key.
 */
export function buckets<T, K>(items: Iterable<T>, key: (item: T) => K): T[][] {
  return [...groupBy(items, key).values()];
}

/**
 * Entry pairs as a plain object, optionally projecting each value. A map's keys
 * are already unique and already the identity, so unlike {@link keyedBy} there
 * is no collision question — this is only ever the `Object.fromEntries` copy,
 * which exists to hand a keyed container to an API that speaks `Record`.
 *
 * Takes entries rather than a `Map` because a `Map` *is* an iterable of entries
 * and half the callers never had one: a query string, a freshly-mapped pair
 * list, a `URLSearchParams`. Naming the map type would have made each of them
 * re-spell the `Object.fromEntries` this replaces.
 */
export function mapToRecord<K extends PropertyKey, V, W = V>(
  source: Iterable<readonly [K, V]>,
  project: (value: V, key: K) => W = (value) => value as unknown as W
): Record<K, W> {
  return keyedBy(source, entryKey<K>, ([, value], key) => project(value, key));
}

/**
 * Index `items` by a derived key into a plain object — the record a lookup
 * table, a scope table or a per-name dispatch map is spelled by hand as
 * `Object.fromEntries(items.map(i => [i.id, i]))`. `PropertyKey` rather than
 * `string` so numeric keys keep object semantics instead of needing a cast,
 * and the value is `V` rather than `T` so a projection (`(r) => r.head`)
 * does not need a second pass.
 */
export function keyedBy<T, K extends PropertyKey, V = T>(
  items: Iterable<T>,
  key: (item: T) => K,
  value: (item: T, key: K) => V = (item) => item as unknown as V
): Record<K, V> {
  const record = {} as Record<K, V>;
  for (const item of items) {
    const k = key(item);
    record[k] = value(item, k);
  }
  return record;
}

/**
 * The key of a `[key, value]` pair — the derivation a Map's own entries need
 * when they are handed to {@link keyedBy} or {@link indexBy} rather than to a
 * plain-object projection. Exported because "index this map by its own keys" is
 * the common case and the destructure was being restated at each one.
 */
export const entryKey = <K>([key]: readonly [K, unknown]): K => key;

/**
 * {@link keyedBy}'s `Map` twin — `new Map(items.map(i => [i.key, i]))`, which
 * eleven sites spelled out because `keyedBy` answered with a `Record` and a
 * lookup table does not have to be an object. Same derived key, same optional
 * projection, and the keys may be any `K` rather than a `PropertyKey`.
 */
export function indexBy<T, K, V = T>(
  items: Iterable<T>,
  key: (item: T) => K,
  value: (item: T, key: K) => V = (item) => item as unknown as V
): Map<K, V> {
  const index = new Map<K, V>();
  for (const item of items) {
    const k = key(item);
    index.set(k, value(item, k));
  }
  return index;
}

/**
 * {@link mapToRecord}'s `Map` twin — the `new Map([...map].map(...))` copy that
 * projects each value *with its own key*, which is the half of the idiom a
 * derived key cannot express.
 */
export function indexMap<K, V, W = V>(
  map: ReadOnlyLookup<K, V>,
  project: (value: V, key: K) => W = (value) => value as unknown as W
): Map<K, W> {
  return indexBy(map, entryKey<K>, ([, value], key) => project(value, key));
}

/**
 * Re-key a record's values while keeping its keys — the `Object.fromEntries(
 * Object.entries(r).map(([k, v]) => [k, project(v)]))` pair, which is a projection
 * wearing a copy's clothes: the keys are already right, only the values change.
 */
export function mapValues<K extends PropertyKey, V, W>(
  record: Readonly<Record<K, V>>,
  project: (value: V, key: K) => W
): Record<K, W> {
  const keys = Object.keys(record) as K[];
  return keyedBy(
    keys,
    (key) => key,
    (key) => project(record[key]!, key)
  );
}

/**
 * Value-level dedup, first occurrence wins. For "the set of concepts this event
 * touched" over a bag that may already hold duplicates — `[...new Set(xs)]` is
 * correct but says nothing about intent, and at seven call sites it read as a
 * different operation each time.
 */
export function unique<T>(items: Iterable<T>): T[] {
  return [...new Set(items)];
}

/**
 * First item per derived key — {@link unique} for a collection whose duplicates
 * are not value-equal but *key*-equal.
 *
 * A term canonicaliser asking "have I seen this shape", a lineage union asking
 * "have I seen this derivation id", a context assembler asking "have I already
 * reported this concept". Each is a `Set` guard inside a `filter`, so the filter
 * predicate carried a side effect and the dedupe could not be composed: a caller
 * that wanted to filter *and* dedupe wrote the guard by hand, and one that wanted
 * only to dedupe wrote a different guard by hand.
 *
 * `key` is evaluated once per item, so a structural key over a term tree is paid
 * once rather than once per comparison the way an equality predicate would be.
 */
export function uniqueBy<T, K>(items: Iterable<T>, key: (item: T) => K): T[] {
  const seen = new Set<K>();
  const kept: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    kept.push(item);
  }
  return kept;
}

/** {@link unique} across several collections — the union an index query needs. */
export function flatUnique<T>(collections: readonly (readonly T[])[]): T[] {
  return unique(collections.flat());
}

/**
 * Remove and return the first match, or `undefined` when nothing matched — and
 * leave the array untouched when nothing did.
 *
 * The `findIndex`-then-`splice` pair, hand-written at every site that also needs
 * the removed item, discovers "absent" only *after* mutating: `splice(-1, 1)`
 * removes the **last** element, so a miss silently destroyed an unrelated entry
 * while the caller reported that nothing happened. Returning the entry is what
 * makes the correct order expressible — decide, then mutate — and it spares the
 * caller a second search over the array it just changed.
 */
export function removeBy<T>(items: T[], predicate: (item: T) => boolean): T | undefined {
  return removeByFrom(items, predicate, false);
}

/** {@link removeBy} scanning backwards, for a stack discipline: the most recent
 *  match, so a stage opened twice closes in the order it was opened. */
export function removeLastBy<T>(items: T[], predicate: (item: T) => boolean): T | undefined {
  return removeByFrom(items, predicate, true);
}

function removeByFrom<T>(
  items: T[],
  predicate: (item: T) => boolean,
  fromLast: boolean
): T | undefined {
  const index = fromLast ? items.findLastIndex(predicate) : items.findIndex(predicate);
  return index < 0 ? undefined : items.splice(index, 1)[0];
}

/** Accumulate a per-key count; returns the new total. Takes a {@link KeyedStore}
 *  so a bounded cache can count as well as a `Map` — the aging counters behind
 *  AIKR sampling live in an `LruCache`, and a `Map`-only signature left that site
 *  re-deriving the `?? 0` it already had. */
export function incrementCount<K>(map: KeyedStore<K, number>, key: K, delta = 1): number {
  const next = (map.get(key) ?? 0) + delta;
  map.set(key, next);
  return next;
}

/**
 * A keyed store that can also drop a key — what {@link removeFromSet} needs and
 * {@link KeyedStore} deliberately does not promise, since populating a map must
 * not require the ability to empty it.
 */
export interface KeyedSetStore<K, T> extends KeyedStore<K, Set<T>> {
  delete(key: K): unknown;
}

/**
 * Add to a per-key set, creating the set on first use.
 *
 * Takes {@link KeyedStore} rather than `Map` so a structurally-keyed store can
 * use it — `TermMap` keys by structural term equality and is the memory
 * system's primary index, so requiring a `Map` here left it re-implementing the
 * lazy-bucket-plus-add that this exists to be.
 */
export function addToSet<K, T>(map: KeyedStore<K, Set<T>>, key: K, value: T): void {
  let bucket = map.get(key);
  if (bucket === undefined) {
    bucket = new Set<T>();
    map.set(key, bucket);
  }
  bucket.add(value);
}

/** Remove from a per-key set, dropping the key once its set empties — otherwise an
 *  index over concepts or links accumulates a bucket per key ever seen. */
export function removeFromSet<K, T>(map: KeyedSetStore<K, T>, key: K, value: T): void {
  const bucket = map.get(key);
  if (!bucket) return;
  bucket.delete(value);
  if (bucket.size === 0) map.delete(key);
}

/**
 * What a bounded ring does when it is full: evict the oldest entry, or refuse the
 * newcomer. A parameter rather than a second class, because the two are the same
 * FIFO with one different answer at capacity — and having two classes meant the
 * refuse-shaped one had no occupancy signal and no iteration, so it was invisible
 * to everything that reports pressure.
 */
export type OverflowPolicy = 'drop-oldest' | 'refuse';

/**
 * Bounded FIFO — the single AIKR ring behind every bounded log (revision history,
 * decision logs, execution history, reward history) and every bounded queue (thread
 * mailboxes). O(1) amortized: one `shift()` per push.
 */
export class BoundedRing<T> implements BoundedContainer<T> {
  readonly #items: T[] = [];

  constructor(
    readonly capacity: number,
    readonly overflow: OverflowPolicy = 'drop-oldest'
  ) {
    if (capacity < 1) throw new RangeError(`BoundedRing capacity must be ≥1, got ${capacity}`);
  }

  size(): number {
    return this.#items.length;
  }

  pressure(): number {
    return occupancy(this.size(), this.capacity);
  }

  /**
   * Append. Returns whichever item did *not* stay: the displaced oldest under
   * `drop-oldest`, the rejected newcomer under `refuse`, `undefined` when there was
   * room. One rule for both policies, so a caller that wants to re-queue or count
   * what it lost reads one return value.
   */
  push(item: T): T | undefined {
    if (this.overflow === 'refuse' && this.#items.length >= this.capacity) return item;
    return pushCapped(this.#items, item, this.capacity);
  }

  /**
   * Append only if there is room, reporting whether the item was admitted. `false`
   * means the ring is full and refuses; under `drop-oldest` an item is always
   * admitted, because that policy pays for admission with an eviction.
   */
  tryPush(item: T): boolean {
    if (this.overflow === 'refuse' && this.#items.length >= this.capacity) return false;
    this.push(item);
    return true;
  }

  /** Remove and return the oldest item — the dequeue half of {@link push}. */
  shift(): T | undefined {
    return this.#items.shift();
  }

  clear(): void {
    this.#items.length = 0;
  }

  first(): T | undefined {
    return this.#items[0];
  }

  last(): T | undefined {
    return this.#items.at(-1);
  }

  /** The most recent `n` items, oldest first. */
  tail(n = this.capacity): T[] {
    return takeLast(this.#items, n);
  }

  toArray(): T[] {
    return [...this.#items];
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.#items.filter(predicate);
  }

  reduce<A>(accumulator: (acc: A, item: T) => A, initial: A): A {
    return this.#items.reduce(accumulator, initial);
  }

  /**
   * Oldest first, live. A ring that exposes `reduce` but not iteration is a
   * container every collection primitive has to be re-fed from `toArray()` —
   * so the bounded-log sites either copied or took the whole ring to count it.
   */
  *[Symbol.iterator](): IterableIterator<T> {
    yield* this.#items;
  }
}
