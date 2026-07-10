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
  hits: number;
}

class LinkedNode<K, V> {
  constructor(
    public key: K,
    public value: V,
    public prev?: LinkedNode<K, V>,
    public next?: LinkedNode<K, V>
  ) {}
}

class LRUCacheImpl<V> implements Disposable {
  private readonly store = new Map<string, LinkedNode<string, V>>();
  private head: LinkedNode<string, V> | undefined;
  private tail: LinkedNode<string, V> | undefined;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(private readonly opts: CacheOptions<V>) {}

  get(key: string): V | undefined {
    const node = this.store.get(key);
    if (!node) {
      this.stats.misses++;
      this.opts.onMiss?.(key);
      return undefined;
    }
    this.moveToFront(node);
    this.stats.hits++;
    this.opts.onHit?.(key);
    return node.value;
  }

  set(key: string, value: V): void {
    const existing = this.store.get(key);
    if (existing) {
      const node = existing;
      node.value = value;
      this.moveToFront(node);
      return;
    }

    if (this.opts.maxSize && this.store.size >= this.opts.maxSize) {
      this.evict();
    }

    const node = new LinkedNode(key, value);
    this.store.set(key, node);
    this.prepend(node);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
    this.head = undefined;
    this.tail = undefined;
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
    };
  }

  [Symbol.dispose](): void {
    this.clear();
  }

  private moveToFront(node: LinkedNode<string, V>): void {
    if (node === this.head) return;
    this.remove(node);
    this.prepend(node);
  }

  private remove(node: LinkedNode<string, V>): void {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;
  }

  private prepend(node: LinkedNode<string, V>): void {
    node.next = this.head;
    node.prev = undefined;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private evict(): void {
    if (!this.tail) return;
    const victim = this.tail;
    this.opts.onEvict?.(victim.key, victim.value);
    this.remove(victim);
    this.store.delete(victim.key);
    this.stats.evictions++;
  }
}

class MapBasedCache<V> implements Disposable {
  private readonly store = new Map<string, CacheEntry<V>>();
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(private readonly opts: CacheOptions<V>) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      this.opts.onMiss?.(key);
      return undefined;
    }

    if (this.opts.ttl && Date.now() - entry.accessed > this.opts.ttl) {
      this.store.delete(key);
      this.stats.misses++;
      return undefined;
    }

    entry.accessed = Date.now();
    entry.hits++;
    this.stats.hits++;
    this.opts.onHit?.(key);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.opts.maxSize && this.store.size >= this.opts.maxSize) {
      this.evict();
    }

    this.store.set(key, { value, accessed: Date.now(), hits: 0 });
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (this.opts.ttl && Date.now() - entry.accessed > this.opts.ttl) {
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
      ...this.stats,
      size: this.store.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
    };
  }

  [Symbol.dispose](): void {
    this.clear();
  }

  private evict(): void {
    const policy = this.opts.policy ?? 'lru';
    let victim: string | undefined;

    switch (policy) {
      case 'lru':
        victim = [...this.store.entries()].sort((a, b) => a[1].accessed - b[1].accessed)[0]?.[0];
        break;
      case 'lfu':
        victim = [...this.store.entries()].sort((a, b) => a[1].hits - b[1].hits)[0]?.[0];
        break;
      case 'fifo':
        victim = this.store.keys().next().value;
        break;
      case 'weak':
        return;
    }

    if (victim) {
      const entry = this.store.get(victim);
      if (entry) this.opts.onEvict?.(victim, entry.value);
      this.store.delete(victim);
      this.stats.evictions++;
    }
  }
}

export class Cache<V> implements Disposable {
  private impl: LRUCacheImpl<V> | MapBasedCache<V>;

  constructor(private readonly opts: CacheOptions<V> = {}) {
    this.impl = opts.policy === 'lru' ? new LRUCacheImpl(opts) : new MapBasedCache(opts);
  }

  get(key: string): V | undefined {
    return this.impl.get(key);
  }

  set(key: string, value: V): void {
    this.impl.set(key, value);
  }

  has(key: string): boolean {
    return this.impl.has(key);
  }

  clear(): void {
    this.impl.clear();
  }

  getStats(): CacheStats {
    return this.impl.getStats();
  }

  [Symbol.dispose](): void {
    this.impl[Symbol.dispose]();
  }
}
