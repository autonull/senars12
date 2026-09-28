/**
 * Bounded buffer primitives shared by every package's bounded logs.
 */

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
