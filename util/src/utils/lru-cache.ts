/**
 * Bounded caches with recency ordering — the single eviction/TTL implementation
 * behind the term, translation, and LM-response caches.
 *
 * Recency is Map insertion order: `get` re-inserts, `set` overwrites, and
 * eviction takes the first key. All O(1) — no sorting, no scans.
 */

interface Entry<V> {
  value: V;
  /** Epoch ms after which the entry is treated as absent. `Infinity` = no TTL. */
  expiresAt: number;
}

export interface LruCacheOptions {
  /** Hard capacity; the least-recently-used key is evicted past it. */
  maxSize?: number;
  /** Entry lifetime in ms. Omit for no expiry. */
  ttlMs?: number;
  /** Injected clock (deterministic tests). */
  now?: () => number;
}

export class LruCache<K, V> {
  readonly #entries = new Map<K, Entry<V>>();
  readonly #maxSize: number;
  readonly #ttlMs: number;
  readonly #now: () => number;
  #hits = 0;
  #misses = 0;

  constructor(options: LruCacheOptions | number = {}) {
    const { maxSize = 1000, ttlMs = Infinity, now = Date.now } =
      typeof options === 'number' ? { maxSize: options } : options;
    this.#maxSize = Math.max(1, maxSize);
    this.#ttlMs = ttlMs;
    this.#now = now;
  }

  get size(): number {
    return this.#entries.size;
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

  get(key: K): V | undefined {
    const hit = this.peek(key);
    if (hit === undefined) this.#misses++;
    else this.#hits++;
    return hit;
  }

  /** Read without counting stats or refreshing recency. */
  peek(key: K): V | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.#now()) {
      this.#entries.delete(key);
      return undefined;
    }
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): this {
    if (this.#entries.has(key)) this.#entries.delete(key);
    else if (this.#entries.size >= this.#maxSize) this.#evictOldest();
    this.#entries.set(key, { value, expiresAt: this.#now() + this.#ttlMs });
    return this;
  }

  delete(key: K): boolean {
    return this.#entries.delete(key);
  }

  has(key: K): boolean {
    return this.peek(key) !== undefined;
  }

  clear(): void {
    this.#entries.clear();
    this.#hits = 0;
    this.#misses = 0;
  }

  /** Live values, least-recently-used first. */
  values(): IterableIterator<V> {
    return this.#liveValues();
  }

  toArray(): V[] {
    return [...this.#liveValues()];
  }

  *#liveValues(): Generator<V> {
    for (const [key, entry] of [...this.#entries]) {
      if (entry.expiresAt <= this.#now()) {
        this.#entries.delete(key);
        continue;
      }
      yield entry.value;
    }
  }

  /** Drop every expired entry. Returns how many were removed. */
  purgeExpired(): number {
    const now = this.#now();
    let removed = 0;
    for (const [key, entry] of this.#entries) {
      if (entry.expiresAt <= now) {
        this.#entries.delete(key);
        removed++;
      }
    }
    return removed;
  }

  #evictOldest(): void {
    const oldest = this.#entries.keys().next().value as K | undefined;
    if (oldest !== undefined) this.#entries.delete(oldest);
  }
}
