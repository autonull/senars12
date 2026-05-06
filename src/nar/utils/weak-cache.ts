interface CacheEntry<T> {
    value: T;
    accesses: number;
    lastAccess: number;
}

export class WeakCache<K extends object, V> {
    private weak = new WeakMap<K, CacheEntry<V>>();
    private lru = new Map<K, CacheEntry<V>>();
    private maxSize: number;
    private ttl: number;

    constructor(maxSize = 100, ttl = 60000) {
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    get(key: K): V | undefined {
        const entryFromWeak = this.weak.get(key);
        if (entryFromWeak) {
            // Promote into LRU map if missing
            if (!this.lru.has(key)) this.lru.set(key, entryFromWeak);
            entryFromWeak.accesses++;
            entryFromWeak.lastAccess = Date.now();
            return entryFromWeak.value;
        }

        const entry = this.lru.get(key);
        if (!entry) return undefined;

        if (Date.now() - entry.lastAccess > this.ttl) {
            this.lru.delete(key);
            this.weak.delete(key);
            return undefined;
        }

        entry.accesses++;
        entry.lastAccess = Date.now();
        this.weak.set(key, entry);
        return entry.value;
    }

    set(key: K, value: V): void {
        if (this.lru.size >= this.maxSize) {
            this.evictLRU();
        }

        const entry: CacheEntry<V> = { value, accesses: 1, lastAccess: Date.now() };
        this.lru.set(key, entry);
        this.weak.set(key, entry);
    }

    has(key: K): boolean {
        const entry = this.weak.get(key) ?? this.lru.get(key);
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

    get size(): number {
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
