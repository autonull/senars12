interface CacheEntry<T> {
    value: T;
    accesses: number;
    lastAccess: number;
}

export class WeakCache<K extends object, V> {
    private weak = new WeakMap<K, V>();
    private lru = new Map<K, CacheEntry<V>>();
    private maxSize: number;
    private ttl: number;

    constructor(maxSize = 100, ttl = 60000) {
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    get(key: K): V | undefined {
        if (this.weak.has(key)) {
            return this.weak.get(key);
        }
        const entry = this.lru.get(key);
        if (!entry) return undefined;

        if (Date.now() - entry.lastAccess > this.ttl) {
            this.lru.delete(key);
            return undefined;
        }

        entry.accesses++;
        entry.lastAccess = Date.now();
        this.weak.set(key, entry.value);
        return entry.value;
    }

    set(key: K, value: V): void {
        if (this.lru.size >= this.maxSize) {
            this.evictLRU();
        }

        this.weak.set(key, value);
        this.lru.set(key, { value, accesses: 1, lastAccess: Date.now() });
    }

    has(key: K): boolean {
        if (this.weak.has(key)) return true;
        const entry = this.lru.get(key);
        if (!entry) return false;
        return Date.now() - entry.lastAccess <= this.ttl;
    }

    delete(key: K): boolean {
        this.weak.delete(key);
        return this.lru.delete(key);
    }

    clear(): void {
        this.weak = new WeakMap();
        this.lru.clear();
    }

    size(): number {
        return this.lru.size;
    }

    private evictLRU(): void {
        let oldest: K | undefined;
        let oldestTime = Infinity;

        for (const [key, entry] of this.lru) {
            if (entry.lastAccess < oldestTime) {
                oldestTime = entry.lastAccess;
                oldest = key;
            }
        }

        if (oldest) {
            this.delete(oldest);
        }
    }
}

export function createWeakCache<K extends object, V>(maxSize?: number, ttl?: number): WeakCache<K, V> {
    return new WeakCache(maxSize, ttl);
}