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
import type { Clock } from './clock';
import { type BoundedContainer, type EvictByScore } from './collections';
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
export declare class BoundedMap<K, V> implements BoundedContainer<V> {
    #private;
    readonly maxSize: number;
    /** Alias for {@link maxSize} to satisfy {@link BoundedContainer}. */
    get capacity(): number;
    constructor(options?: BoundedMapOptions<K, V> | number);
    size(): number;
    /** Occupancy in `0..1` — the AIKR pressure signal the bounded containers report. */
    pressure(): number;
    evict(key: K): boolean;
    get(key: K): V | undefined;
    /** Read without refreshing recency. */
    peek(key: K): V | undefined;
    /** Refresh recency without a read — the "this was just used" signal. */
    touch(key: K): boolean;
    set(key: K, value: V): this;
    /** Remove without firing `onEvict` — the caller already knows what it is releasing. */
    delete(key: K): boolean;
    has(key: K): boolean;
    clear(): void;
    /** Live keys, least-recently-used first. */
    keys(): Generator<K>;
    /** Live values, least-recently-used first. */
    values(): IterableIterator<V>;
    /** Live pairs, least-recently-used first. */
    entries(): Generator<[K, V]>;
    /** Iteration alias of {@link entries}, so a bounded map is a drop-in for a `Map` read. */
    [Symbol.iterator](): Generator<[K, V]>;
    toArray(): V[];
    /** Drop every expired entry. Returns how many were removed. */
    purgeExpired(): number;
}
//# sourceMappingURL=bounded-map.d.ts.map