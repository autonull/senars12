// Small collection helpers to reduce common Map boilerplate

/**
 * Returns the top `n` items from an iterable ranked by `score`, descending.
 * Single-pass with a bounded buffer — avoids materializing/sorting the full input.
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

export function getOrInsert<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const v = factory();
  map.set(key, v);
  return v;
}

export function incrementCount<K>(map: Map<K, number>, key: K, delta = 1): number {
  const prev = map.get(key) ?? 0;
  const next = prev + delta;
  map.set(key, next);
  return next;
}

export function addToSet<K, T>(map: Map<K, Set<T>>, key: K, value: T): void {
  const set = map.get(key) ?? new Set<T>();
  set.add(value);
  map.set(key, set);
}

/**
 * Drop-oldest bounded buffer — the single AIKR ring behind every bounded log
 * (revision history, decision logs, execution history, reward history). O(1)
 * amortized: one `shift()` per push, no `splice` reallocation, no cap arithmetic
 * duplicated at each call site.
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
