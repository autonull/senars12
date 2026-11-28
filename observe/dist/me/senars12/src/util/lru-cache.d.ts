/**
 * Bounded cache with hit/miss accounting — the recency specialisation of
 * {@link BoundedMap}, and what the term, translation, and LM-response caches
 * use. Everything except the counters is inherited; a caller that needs an
 * eviction order other than recency wants `BoundedMap` directly.
 */
import { BoundedMap, type BoundedMapOptions } from './bounded-map';
export type LruCacheOptions<K = unknown, V = unknown> = BoundedMapOptions<K, V>;
export declare class LruCache<K, V> extends BoundedMap<K, V> {
    #private;
    constructor(options?: LruCacheOptions<K, V> | number);
    get hits(): number;
    get misses(): number;
    get hitRate(): number;
    get(key: K): V | undefined;
    /**
     * Read an entry and remove it in one step — read-once semantics, so a
     * concurrent second reader sees the miss rather than the same value. Returns
     * `undefined` for absent and expired keys, exactly as {@link get}.
     */
    take(key: K): V | undefined;
    clear(): void;
}
//# sourceMappingURL=lru-cache.d.ts.map