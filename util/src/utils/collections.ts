/**
 * Bounded buffer primitives shared by every package's bounded logs.
 */

/**
 * Drop-oldest push for plain arrays. One `shift()` per overflow — no `splice`
 * reallocation and no cap arithmetic repeated at the call site.
 */
export function pushCapped<T>(log: T[], item: T, capacity: number): void {
  log.push(item);
  if (log.length > capacity) log.shift();
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
  const better = (a: T, b: T) => a.priority > b.priority || (a.priority === b.priority && a.id < b.id);
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

/** Lazily-created map entry — the single get-or-create primitive for nested maps. */
export function getOrInsert<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
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

  push(item: T): void {
    this.#items.push(item);
    if (this.#items.length > this.capacity) this.#items.shift();
  }

  clear(): void {
    this.#items.length = 0;
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
