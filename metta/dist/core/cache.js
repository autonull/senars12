class LinkedNode {
  key;
  value;
  prev;
  next;
  constructor(key, value, prev, next) {
    this.key = key;
    this.value = value;
    this.prev = prev;
    this.next = next;
  }
}
class LRUCacheImpl {
  opts;
  store = new Map();
  head;
  tail;
  stats = { hits: 0, misses: 0, evictions: 0 };
  constructor(opts) {
    this.opts = opts;
  }
  get(key) {
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
  set(key, value) {
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
  has(key) {
    return this.store.has(key);
  }
  clear() {
    this.store.clear();
    this.head = undefined;
    this.tail = undefined;
  }
  getStats() {
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
    };
  }
  [Symbol.dispose]() {
    this.clear();
  }
  moveToFront(node) {
    if (node === this.head) return;
    this.remove(node);
    this.prepend(node);
  }
  remove(node) {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;
  }
  prepend(node) {
    node.next = this.head;
    node.prev = undefined;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }
  evict() {
    if (!this.tail) return;
    const victim = this.tail;
    this.opts.onEvict?.(victim.key, victim.value);
    this.remove(victim);
    this.store.delete(victim.key);
    this.stats.evictions++;
  }
}
class MapBasedCache {
  opts;
  store = new Map();
  stats = { hits: 0, misses: 0, evictions: 0 };
  constructor(opts) {
    this.opts = opts;
  }
  get(key) {
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
  set(key, value) {
    if (this.opts.maxSize && this.store.size >= this.opts.maxSize) {
      this.evict();
    }
    this.store.set(key, { value, accessed: Date.now(), hits: 0 });
  }
  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (this.opts.ttl && Date.now() - entry.accessed > this.opts.ttl) {
      this.store.delete(key);
      return false;
    }
    return true;
  }
  clear() {
    this.store.clear();
  }
  getStats() {
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
    };
  }
  [Symbol.dispose]() {
    this.clear();
  }
  evict() {
    const policy = this.opts.policy ?? 'lru';
    let victim;
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
export class Cache {
  opts;
  impl;
  constructor(opts = {}) {
    this.opts = opts;
    this.impl = opts.policy === 'lru' ? new LRUCacheImpl(opts) : new MapBasedCache(opts);
  }
  get(key) {
    return this.impl.get(key);
  }
  set(key, value) {
    this.impl.set(key, value);
  }
  has(key) {
    return this.impl.has(key);
  }
  clear() {
    this.impl.clear();
  }
  getStats() {
    return this.impl.getStats();
  }
  [Symbol.dispose]() {
    this.impl[Symbol.dispose]();
  }
}
//# sourceMappingURL=cache.js.map
