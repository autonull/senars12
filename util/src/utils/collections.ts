/**
 * Bounded buffer and selection primitives shared by every package's
 * bounded logs, bags, and priority ordering.
 */

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
 * The first `fraction` of `items`, at least `count` and never all of them.
 *
 * Pressure relief always wants a *share* of a pool, and every site computed it as
 * `min(size, ceil(size * share))` followed by a slice — which is a cap and a
 * rounding rule, spelled out four times with the rounding left to differ. A share
 * of zero must yield nothing rather than the `count` floor, or a container under
 * no pressure sheds its minimum anyway.
 */
export const shareOf = <T>(items: readonly T[], fraction: number, count: number = 0): T[] => {
  const target = Math.min(items.length, Math.max(count, Math.ceil(items.length * fraction)));
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
 * Returns how many were dropped, for the callers that report it. The list
 * counterpart of {@link pushCapped} for the callers that cannot push through it.
 */
export function trimCapped<T>(log: T[], capacity: number): number {
  const dropped = Math.max(0, log.length - capacity);
  if (dropped > 0) log.splice(0, dropped);
  return dropped;
}

/**
 * Extremum pick over a collection. `initial`/`initialScore` seed the running
 * best, so callers can carry a floor (e.g. `maxBy(items, score, item, -1)`)
 * through the same single O(n) scan.
 */
export function minBy<T>(
  items: readonly T[],
  score: (item: T) => number,
  initial?: T,
  initialScore = Number.POSITIVE_INFINITY
): T | undefined {
  let best = initial;
  let bestScore = initialScore;
  for (const item of items) {
    const value = score(item);
    if (value < bestScore) {
      best = item;
      bestScore = value;
    }
  }
  return best;
}

export function maxBy<T>(
  items: readonly T[],
  score: (item: T) => number,
  initial?: T,
  initialScore = Number.NEGATIVE_INFINITY
): T | undefined {
  let best = initial;
  let bestScore = initialScore;
  for (const item of items) {
    const value = score(item);
    if (value > bestScore) {
      best = item;
      bestScore = value;
    }
  }
  return best;
}

/**
 * Highest `score` over `items`, floored at 0. Single pass over the iterable
 * with no intermediate array and no second evaluation of `score` — `maxBy`
 * returns the winning item instead, which forces callers that only want the
 * number to either re-derive it or copy the collection first.
 */
export function maxScore<T>(items: Iterable<T>, score: (item: T) => number): number {
  let max = 0;
  for (const item of items) {
    const value = score(item);
    if (value > max) max = value;
  }
  return max;
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
 */
export function selectTopN<T>(items: Iterable<T>, n: number, score: (item: T) => number): T[] {
  if (n <= 0) return [];
  const result: T[] = [];
  const scores: number[] = [];
  for (const item of items) {
    const s = score(item);
    if (result.length < n) {
      result.push(item);
      scores.push(s);
      let i = result.length - 1;
      while (i > 0 && scores[i - 1]! < s) {
        result[i] = result[i - 1]!;
        scores[i] = scores[i - 1]!;
        i--;
      }
      result[i] = item;
      scores[i] = s;
    } else if (s > scores[n - 1]!) {
      result[n - 1] = item;
      scores[n - 1] = s;
      let i = n - 1;
      while (i > 0 && scores[i - 1]! < s) {
        result[i] = result[i - 1]!;
        scores[i] = scores[i - 1]!;
        i--;
      }
      result[i] = item;
      scores[i] = s;
    }
  }
  return result;
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
  if (budget <= 0) return [];
  const better = (a: T, b: T) =>
    a.priority > b.priority || (a.priority === b.priority && a.id < b.id);
  const kept: T[] = [];
  let worst = 0;
  for (const item of items) {
    if (!eligible(item)) continue;
    if (kept.length === budget) {
      if (!better(item, kept[worst]!)) continue;
      kept[worst] = item;
    } else {
      kept.push(item);
    }
    worst = 0;
    for (let i = 1; i < kept.length; i++) if (better(kept[i]!, kept[worst]!)) worst = i;
  }
  return kept.sort((a, b) => Number(better(b, a)) - Number(better(a, b)));
}

/** The get/set surface a keyed store must expose to be lazily populated. */
export interface KeyedStore<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): unknown;
}

/** Lazily-created map entry — the single get-or-create primitive for nested maps. */
export function getOrInsert<K, V>(map: KeyedStore<K, V>, key: K, factory: () => V): V {
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const created = factory();
  map.set(key, created);
  return created;
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
 * A map as a plain object, optionally projecting each value. A map's keys are
 * already unique and already the identity, so unlike {@link keyedBy} there is no
 * collision question — this is only ever the `Object.fromEntries(map)` copy,
 * which exists to hand a keyed container to an API that speaks `Record`.
 */
export function mapToRecord<K extends PropertyKey, V, W = V>(
  map: ReadonlyMap<K, V>,
  project: (value: V, key: K) => W = (value) => value as unknown as W
): Record<K, W> {
  const record = {} as Record<K, W>;
  for (const [key, value] of map) record[key] = project(value, key);
  return record;
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
  value: (item: T) => V = (item) => item as unknown as V
): Record<K, V> {
  const record = {} as Record<K, V>;
  for (const item of items) record[key(item)] = value(item);
  return record;
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
  const out = {} as Record<K, W>;
  for (const key of Object.keys(record) as K[]) out[key] = project(record[key]!, key);
  return out;
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

/** {@link unique} across several collections — the union an index query needs. */
export function flatUnique<T>(collections: Iterable<readonly T[]>): T[] {
  return unique(collect(collections));
}

function* collect<T>(collections: Iterable<readonly T[]>): Generator<T> {
  for (const collection of collections) yield* collection;
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

/** Accumulate a per-key count; returns the new total. */
export function incrementCount<K>(map: Map<K, number>, key: K, delta = 1): number {
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
  getOrInsert(map, key, () => new Set<T>()).add(value);
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
 * Drop-oldest bounded buffer — the single AIKR ring behind every bounded log
 * (revision history, decision logs, execution history, reward history). O(1)
 * amortized: one `shift()` per push.
 */
export class BoundedRing<T> implements BoundedContainer<T> {
  readonly #items: T[] = [];

  constructor(readonly capacity: number) {
    if (capacity < 1) throw new RangeError(`BoundedRing capacity must be ≥1, got ${capacity}`);
  }

  size(): number {
    return this.#items.length;
  }

  pressure(): number {
    return this.size() / this.capacity;
  }

  /** Append, dropping the oldest item past capacity. Returns what was displaced. */
  push(item: T): T | undefined {
    return pushCapped(this.#items, item, this.capacity);
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
    return this.#items.slice(-n);
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
