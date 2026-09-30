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
 * Drop-oldest push for plain arrays. One `shift()` per overflow — no `splice`
 * reallocation and no cap arithmetic repeated at the call site. Returns the
 * displaced item, which is what a sliding-window caller needs and what every
 * other caller ignores.
 */
/**
 * The read surface every consumer of a keyed container needs and no more —
 * `Map`, `BoundedMap`, and any bounded projection all satisfy it, so a caller
 * that only looks keys up does not have to name a container.
 */
export interface ReadOnlyLookup<K, V> extends Iterable<[K, V]> {
  get(key: K): V | undefined;
  has(key: K): boolean;
}

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

/** Ascending copy sorted by a derived numeric key — never mutates the input. */
export function sortBy<T>(items: Iterable<T>, score: (item: T) => number): T[] {
  return [...items].sort((a, b) => score(a) - score(b));
}
export function sortByDesc<T>(items: Iterable<T>, score: (item: T) => number): T[] {
  return [...items].sort((a, b) => score(b) - score(a));
}

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

/** Accumulate a per-key count; returns the new total. */
export function incrementCount<K>(map: Map<K, number>, key: K, delta = 1): number {
  const next = (map.get(key) ?? 0) + delta;
  map.set(key, next);
  return next;
}

/** Add to a per-key set, creating the set on first use. */
export function addToSet<K, T>(map: Map<K, Set<T>>, key: K, value: T): void {
  getOrInsert(map, key, () => new Set<T>()).add(value);
}

/** Remove from a per-key set, dropping the key once its set empties — otherwise an
 *  index over concepts or links accumulates a bucket per key ever seen. */
export function removeFromSet<K, T>(map: Map<K, Set<T>>, key: K, value: T): void {
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
export class BoundedRing<T> {
  readonly #items: T[] = [];

  constructor(readonly capacity: number) {
    if (capacity < 1) throw new RangeError(`BoundedRing capacity must be ≥1, got ${capacity}`);
  }

  get size(): number {
    return this.#items.length;
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
}
