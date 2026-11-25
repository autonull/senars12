import { occupancy } from '../numeric';
import { SenarsError } from '../../errors/senars-error';

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

/** The get/set surface a keyed store must expose to be lazily populated. */
export interface KeyedStore<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): unknown;
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
 * mailboxes). True O(1) push/shift via circular buffer.
 */
export class BoundedRing<T> implements BoundedContainer<T> {
  readonly #buffer: (T | undefined)[];
  #head = 0;
  #tail = 0;
  #size = 0;

  constructor(
    readonly capacity: number,
    readonly overflow: OverflowPolicy = 'drop-oldest'
  ) {
    if (capacity < 1) throw new RangeError(`BoundedRing capacity must be ≥1, got ${capacity}`);
    this.#buffer = new Array(capacity);
  }

  size(): number {
    return this.#size;
  }

  pressure(): number {
    return occupancy(this.#size, this.capacity);
  }

  /**
   * Append. Returns whichever item did *not* stay: the displaced oldest under
   * `drop-oldest`, the rejected newcomer under `refuse`, `undefined` when there was
   * room. One rule for both policies, so a caller that wants to re-queue or count
   * what it lost reads one return value.
   */
  push(item: T): T | undefined {
    if (this.overflow === 'refuse' && this.#size >= this.capacity) return item;

    let displaced: T | undefined;
    if (this.#size === this.capacity) {
      // Buffer full: overwrite oldest (at head)
      displaced = this.#buffer[this.#head]!;
      this.#buffer[this.#head] = item;
      this.#head = (this.#head + 1) % this.capacity;
      this.#tail = (this.#tail + 1) % this.capacity;
    } else {
      // Room available
      this.#buffer[this.#tail] = item;
      this.#tail = (this.#tail + 1) % this.capacity;
      this.#size++;
    }
    return displaced;
  }

  /**
   * Append only if there is room, reporting whether the item was admitted. `false`
   * means the ring is full and refuses; under `drop-oldest` an item is always
   * admitted, because that policy pays for admission with an eviction.
   */
  tryPush(item: T): boolean {
    if (this.overflow === 'refuse' && this.#size >= this.capacity) return false;
    this.push(item);
    return true;
  }

  /** Remove and return the oldest item — the dequeue half of {@link push}. */
  shift(): T | undefined {
    if (this.#size === 0) return undefined;
    const item = this.#buffer[this.#head]!;
    this.#buffer[this.#head] = undefined;
    this.#head = (this.#head + 1) % this.capacity;
    this.#size--;
    return item;
  }

  clear(): void {
    if (this.#size > 0) {
      for (let i = 0; i < this.#size; i++) {
        const idx = (this.#head + i) % this.capacity;
        this.#buffer[idx] = undefined;
      }
      this.#head = 0;
      this.#tail = 0;
      this.#size = 0;
    }
  }

  first(): T | undefined {
    return this.#size > 0 ? this.#buffer[this.#head] : undefined;
  }

  last(): T | undefined {
    return this.#size > 0 ? this.#buffer[(this.#tail - 1 + this.capacity) % this.capacity] : undefined;
  }

  /** The most recent `n` items, oldest first. */
  tail(n = this.capacity): T[] {
    const count = Math.min(n, this.#size);
    if (count === 0) return [];
    const result = new Array(count);
    for (let i = 0; i < count; i++) {
      const idx = (this.#tail - count + i + this.capacity) % this.capacity;
      result[i] = this.#buffer[idx]!;
    }
    return result;
  }

  toArray(): T[] {
    const result = new Array(this.#size);
    for (let i = 0; i < this.#size; i++) {
      result[i] = this.#buffer[(this.#head + i) % this.capacity]!;
    }
    return result;
  }

  filter(predicate: (item: T) => boolean): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.#size; i++) {
      const item = this.#buffer[(this.#head + i) % this.capacity]!;
      if (predicate(item)) result.push(item);
    }
    return result;
  }

  reduce<A>(accumulator: (acc: A, item: T) => A, initial: A): A {
    let acc = initial;
    for (let i = 0; i < this.#size; i++) {
      acc = accumulator(acc, this.#buffer[(this.#head + i) % this.capacity]!);
    }
    return acc;
  }

  /**
   * Oldest first, live.
   */
  *[Symbol.iterator](): IterableIterator<T> {
    for (let i = 0; i < this.#size; i++) {
      yield this.#buffer[(this.#head + i) % this.capacity]!;
    }
  }
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
 * Returns how many were dropped, for the callers that report it. The in-place
 * counterpart of {@link takeLast}, for the callers that own the array.
 */
export function trimCapped<T>(log: T[], capacity: number): number {
  const dropped = Math.max(0, log.length - capacity);
  if (dropped > 0) log.splice(0, dropped);
  return dropped;
}

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

/** Fixed-size slices for batched work — the one chunking primitive. */
export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const step = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step) as T[]);
  return out;
};