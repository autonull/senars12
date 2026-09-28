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
 * Drop-oldest bounded buffer — the single AIKR ring behind every bounded log
 * (revision history, decision logs, execution history, reward history). O(1)
 * amortized: one `shift()` per push.
 */
/** Extremum pick over a non-empty array; `undefined` for an empty one. */
export function minBy<T>(items: readonly T[], score: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const value = score(item);
    if (value < bestScore) {
      best = item;
      bestScore = value;
    }
  }
  return best;
}

export function maxBy<T>(items: readonly T[], score: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
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
