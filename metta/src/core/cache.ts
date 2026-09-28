export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl' | 'weak';

export interface CacheOptions<V> {
  readonly maxSize?: number;
  readonly ttl?: number;
  readonly policy?: EvictionPolicy;
  readonly weakRefs?: boolean;
  readonly onEvict?: (key: string, value: V) => void;
  readonly onHit?: (key: string) => void;
  readonly onMiss?: (key: string) => void;
}

export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
  readonly evictions: number;
  readonly hitRate: number;
}

interface CacheEntry<V> {
  value: V;
  accessed: number;
  inserted: number;
  hits: number;
}

/**
 * Bounded key→value cache with pluggable eviction. `lru` is O(1) per access
 * (recency is Map insertion order, refreshed on read); `fifo` and `lfu` scan
 * once per eviction and therefore degrade to O(n) inserts under pressure.
 */
class CacheImpl<V> implements Disposable {
  private readonly store = new Map<string, CacheEntry<V>>();
  private readonly policy: EvictionPolicy;
  private readonly maxSize: number;
  private readonly ttl: number;
  private sequence = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(private readonly opts: CacheOptions<V>) {
    this.policy = opts.policy ?? 'lru';
    this.maxSize = opts.maxSize ?? Number.POSITIVE_INFINITY;
    this.ttl = opts.ttl ?? Number.POSITIVE_INFINITY;
  }

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry || this.#expired(entry)) {
      if (entry) this.store.delete(key);
      this.misses++;
      this.opts.onMiss?.(key);
      return undefined;
    }
    this.hits++;
    entry.hits++;
    entry.accessed = Date.now();
    if (this.policy === 'lru') this.#refresh(key, entry);
    this.opts.onHit?.(key);
    return entry.value;
  }

  set(key: string, value: V): void {
    const existing = this.store.get(key);
    if (existing) {
      existing.value = value;
      existing.accessed = Date.now();
      if (this.policy === 'lru') this.#refresh(key, existing);
      return;
    }
    if (this.store.size >= this.maxSize) this.evict();
    this.store.set(key, { value, accessed: Date.now(), inserted: this.sequence++, hits: 0 });
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (this.#expired(entry)) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.store.clear();
  }

  getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.store.size,
      hitRate: this.hits / (this.hits + this.misses) || 0,
    };
  }

  [Symbol.dispose](): void {
    this.clear();
  }

  /** Re-insert to move the key to the most-recently-used end of the Map. */
  #refresh(key: string, entry: CacheEntry<V>): void {
    this.store.delete(key);
    this.store.set(key, entry);
  }

  #expired(entry: CacheEntry<V>): boolean {
    return this.ttl !== Number.POSITIVE_INFINITY && Date.now() - entry.accessed > this.ttl;
  }

  private evict(): void {
    if (this.policy === 'weak' || this.store.size === 0) return;
    const victim =
      this.policy === 'lru'
        ? this.store.keys().next().value
        : this.#weakest(this.policy === 'lfu' ? ((e) => e.hits) : ((e) => e.inserted));
    if (victim === undefined) return;
    const entry = this.store.get(victim);
    if (entry) this.opts.onEvict?.(victim, entry.value);
    this.store.delete(victim);
    this.evictions++;
  }

  #weakest(rank: (entry: CacheEntry<V>) => number): string | undefined {
    let worstKey: string | undefined;
    let worst = Number.POSITIVE_INFINITY;
    for (const [key, entry] of this.store) {
      const value = rank(entry);
      if (value < worst) {
        worst = value;
        worstKey = key;
      }
    }
    return worstKey;
  }
}

export class Cache<V> implements Disposable {
  readonly #impl: CacheImpl<V>;

  constructor(readonly opts: CacheOptions<V> = {}) {
    this.#impl = new CacheImpl(opts);
  }

  get(key: string): V | undefined {
    return this.#impl.get(key);
  }

  set(key: string, value: V): void {
    this.#impl.set(key, value);
  }

  has(key: string): boolean {
    return this.#impl.has(key);
  }

  clear(): void {
    this.#impl.clear();
  }

  getStats(): CacheStats {
    return this.#impl.getStats();
  }

  [Symbol.dispose](): void {
    this.#impl[Symbol.dispose]();
  }
}
