/**
 * The capacity- and time-bounded map every bounded container in the repository
 * is a specialisation of: the recency caches, the ledger hot cache, and the
 * associative-memory layers.
 *
 * One `Map` holds the state. Recency is that map's insertion order — `touch`
 * re-inserts, `set` overwrites, and the oldest key is the first — so the
 * recency orderings are O(1) reads of a structure that was already there. A
 * caller-supplied order (`{ by }`) instead scans the live set once per
 * eviction, which is inherent to "lowest score loses" and not an artefact of
 * the container.
 */

import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import { type BoundedContainer, type EvictByScore, minBy } from './collections.js';
import { occupancy } from './numeric.js';
import { nextInt } from './random.js';

interface Entry<V> {
  value: V;
  /** Epoch ms after which the entry is treated as absent. `Infinity` = no TTL. */
  expiresAt: number;
}

/**
 * Eviction order. `lru` and `fifo` differ only in whether a read refreshes
 * recency, which {@link BoundedMapOptions.touchOnRead} carries; `random` draws
 * one uniform index; `{ by }` evicts the live entry with the lowest score and
 * breaks ties by insertion order (creation order, which is finer-grained than
 * any millisecond stamp).
 */
export type EvictionOrder<V> = 'lru' | 'fifo' | 'random' | EvictByScore<V>;

export interface BoundedMapOptions<K = unknown, V = unknown> {
  /** Hard capacity; the victim chosen by `eviction` is dropped past it. */
  maxSize?: number;
  /** Entry lifetime in ms. Omit for no expiry. */
  ttlMs?: number;
  /** Injected clock (deterministic tests). */
  now?: Clock;
  /**
   * Called once per entry removed by capacity eviction, TTL expiry, purge, or
   * `clear()` — the hook through which callers release side resources
   * (index entries, buffers, metrics) held outside the map. A silent
   * {@link BoundedMap.delete} does not fire it, so an explicit removal and the
   * cleanup it triggers stay one call site.
   */
  onEvict?: (value: V, key: K) => void;
  eviction?: EvictionOrder<V>;
  /**
   * Whether reading refreshes recency. Defaults to `true` for `lru` and
   * `false` otherwise, since the other orders do not read it.
   */
  touchOnRead?: boolean;
  /** Injected randomness for the `random` order (default `Math.random`). */
  rng?: () => number;
}

export class BoundedMap<K, V> implements BoundedContainer<V> {
  readonly #entries = new Map<K, Entry<V>>();
  public readonly maxSize: number;

  /** Alias for {@link maxSize} to satisfy {@link BoundedContainer}. */
  get capacity(): number {
    return this.maxSize;
  }

  readonly #ttlMs: number;
  readonly #neverExpires: boolean;
  readonly #now: Clock;
  readonly #onEvict?: (value: V, key: K) => void;
  readonly #order: EvictionOrder<V>;
  readonly #touchOnRead: boolean;
  readonly #rng: () => number;

  constructor(options: BoundedMapOptions<K, V> | number = {}) {
    const {
      maxSize = 1000,
      ttlMs = Infinity,
      now = systemClock,
      onEvict,
      eviction = 'lru',
      rng,
      touchOnRead,
    } = typeof options === 'number' ? { maxSize: options } : options;
    this.maxSize = Math.max(1, maxSize);
    this.#ttlMs = ttlMs;
    this.#neverExpires = ttlMs === Infinity;
    this.#now = now;
    this.#onEvict = onEvict;
    this.#order = eviction;
    this.#touchOnRead = touchOnRead ?? eviction === 'lru';
    this.#rng = rng ?? Math.random;
  }

  size(): number {
    return this.#entries.size;
  }

  /** Occupancy in `0..1` — the AIKR pressure signal the bounded containers report. */
  pressure(): number {
    return occupancy(this.size(), this.maxSize);
  }

  evict(key: K): boolean {
    const entry = this.#entries.get(key);
    if (entry === undefined) return false;
    this.#entries.delete(key);
    this.#onEvict?.(entry.value, key);
    return true;
  }

  get(key: K): V | undefined {
    const entry = this.#live(key);
    if (entry === undefined) return undefined;
    if (this.#touchOnRead) this.#reinsert(key, entry);
    return entry.value;
  }

  /** Read without refreshing recency. */
  peek(key: K): V | undefined {
    return this.#live(key)?.value;
  }

  /** Refresh recency without a read — the "this was just used" signal. */
  touch(key: K): boolean {
    const entry = this.#live(key);
    if (entry === undefined) return false;
    this.#reinsert(key, entry);
    return true;
  }

  set(key: K, value: V): this {
    if (this.#entries.has(key)) this.#entries.delete(key);
    else if (this.#entries.size >= this.maxSize) this.#evictVictim();
    this.#entries.set(key, {
      value,
      expiresAt: this.#neverExpires ? Infinity : this.#now() + this.#ttlMs,
    });
    return this;
  }

  /** Remove without firing `onEvict` — the caller already knows what it is releasing. */
  delete(key: K): boolean {
    return this.#entries.delete(key);
  }

  has(key: K): boolean {
    return this.#live(key) !== undefined;
  }

  clear(): void {
    for (const [key, entry] of this.#entries) this.#onEvict?.(entry.value, key);
    this.#entries.clear();
  }

  /**
   * Live entries, least-recently-used first, iterated in place: the only mutation
   * an iteration performs is `evict` of the entry it stands on, and a `Map`
   * iterator tolerates deletion of the current key. Snapshotting first allocated
   * an array of the whole map per iteration, on every cache scan and layer sweep.
   */
  *#liveEntries(): Generator<[K, V]> {
    for (const [key, entry] of this.#entries) {
      if (this.#expired(entry)) this.evict(key);
      else yield [key, entry.value];
    }
  }

  /** Live keys, least-recently-used first. */
  *keys(): Generator<K> {
    for (const [key] of this.#liveEntries()) yield key;
  }

  /** Live values, least-recently-used first. */
  *values(): IterableIterator<V> {
    for (const [, value] of this.#liveEntries()) yield value;
  }

  /** Live pairs, least-recently-used first. */
  *entries(): Generator<[K, V]> {
    yield* this.#liveEntries();
  }

  /** Iteration alias of {@link entries}, so a bounded map is a drop-in for a `Map` read. */
  [Symbol.iterator](): Generator<[K, V]> {
    return this.entries();
  }

  toArray(): V[] {
    return [...this.values()];
  }

  /** Drop every expired entry. Returns how many were removed. */
  purgeExpired(): number {
    if (this.#neverExpires) return 0;
    let removed = 0;
    for (const [key, entry] of this.#entries) {
      if (this.#expired(entry) && this.evict(key)) removed++;
    }
    return removed;
  }

  #live(key: K): Entry<V> | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    if (this.#expired(entry)) {
      this.evict(key);
      return undefined;
    }
    return entry;
  }

  #expired(entry: Entry<V>): boolean {
    return !this.#neverExpires && entry.expiresAt <= this.#now();
  }

  #reinsert(key: K, entry: Entry<V>): void {
    this.#entries.delete(key);
    this.#entries.set(key, entry);
  }

  #evictVictim(): void {
    const victim = this.#selectVictim();
    if (victim !== undefined) this.evict(victim);
  }

  #selectVictim(): K | undefined {
    if (this.#order === 'lru' || this.#order === 'fifo') {
      return this.#entries.keys().next().value as K | undefined;
    }
    if (this.#order === 'random') return this.#randomKey();
    const { by } = this.#order as EvictByScore<V>;
    return minBy(this.#entries, ([, entry]) => by(entry.value))?.[0];
  }

  /** Uniform pick over the live keys, counted rather than copied. */
  #randomKey(): K | undefined {
    const target = nextInt(this.#rng, this.#entries.size);
    let seen = 0;
    for (const key of this.#entries.keys()) {
      if (seen++ === target) return key;
    }
    return undefined;
  }
}
