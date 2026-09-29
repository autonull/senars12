/**
 * Bounded cache with hit/miss accounting — the recency specialisation of
 * {@link BoundedMap}, and what the term, translation, and LM-response caches
 * use. Everything except the counters is inherited; a caller that needs an
 * eviction order other than recency wants `BoundedMap` directly.
 */

import { BoundedMap, type BoundedMapOptions } from './bounded-map.js';

export type LruCacheOptions<K = unknown, V = unknown> = BoundedMapOptions<K, V>;

export class LruCache<K, V> extends BoundedMap<K, V> {
  #hits = 0;
  #misses = 0;

  constructor(options: LruCacheOptions<K, V> | number = {}) {
    super(options);
  }

  get hits(): number {
    return this.#hits;
  }

  get misses(): number {
    return this.#misses;
  }

  get hitRate(): number {
    const total = this.#hits + this.#misses;
    return total > 0 ? this.#hits / total : 0;
  }

  override get(key: K): V | undefined {
    const value = super.get(key);
    if (value === undefined) this.#misses++;
    else this.#hits++;
    return value;
  }

  /**
   * Read an entry and remove it in one step — read-once semantics, so a
   * concurrent second reader sees the miss rather than the same value. Returns
   * `undefined` for absent and expired keys, exactly as {@link get}.
   */
  take(key: K): V | undefined {
    const value = this.get(key);
    if (value !== undefined) this.delete(key);
    return value;
  }

  override clear(): void {
    super.clear();
    this.#hits = 0;
    this.#misses = 0;
  }
}
