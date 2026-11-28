/**
 * The read surface every consumer of a keyed container needs and no more —
 * `Map`, `BoundedMap`, and any bounded projection all satisfy it, so a caller
 * that only looks keys up does not have to name a container.
 */
export interface ReadOnlyLookup<K, V> extends Iterable<[K, V]> {
    get(key: K): V | undefined;
    has(key: K): boolean;
}
/**
 * Common interface for all bounded containers — captures the shared operations
 * across `BoundedRing`, `BoundedMap`, `Bag`, and other capacity-limited structures.
 * Enables generic utilities that work with any bounded container.
 */
export interface BoundedContainer<T> {
    /** Hard capacity limit. */
    readonly capacity: number;
    /** Current number of live items. */
    size(): number;
    /** Occupancy ratio in `0..1` — the AIKR pressure signal. */
    pressure(): number;
    /** Remove all items. */
    clear(): void;
}
/** The get/set surface a keyed store must expose to be lazily populated. */
export interface KeyedStore<K, V> {
    get(key: K): V | undefined;
    set(key: K, value: V): unknown;
}
/**
 * A keyed store that can also drop a key — what {@link removeFromSet} needs and
 * {@link KeyedStore} deliberately does not promise, since populating a map must
 * not require the ability to empty it.
 */
export interface KeyedSetStore<K, T> extends KeyedStore<K, Set<T>> {
    delete(key: K): unknown;
}
/**
 * What a bounded ring does when it is full: evict the oldest entry, or refuse the
 * newcomer. A parameter rather than a second class, because the two are the same
 * FIFO with one different answer at capacity — and having two classes meant the
 * refuse-shaped one had no occupancy signal and no iteration, so it was invisible
 * to everything that reports pressure.
 */
export type OverflowPolicy = 'drop-oldest' | 'refuse';
/**
 * Bounded FIFO — the single AIKR ring behind every bounded log (revision history,
 * decision logs, execution history, reward history) and every bounded queue (thread
 * mailboxes). True O(1) push/shift via circular buffer.
 */
export declare class BoundedRing<T> implements BoundedContainer<T> {
    #private;
    readonly capacity: number;
    readonly overflow: OverflowPolicy;
    constructor(capacity: number, overflow?: OverflowPolicy);
    size(): number;
    pressure(): number;
    /**
     * Append. Returns whichever item did *not* stay: the displaced oldest under
     * `drop-oldest`, the rejected newcomer under `refuse`, `undefined` when there was
     * room. One rule for both policies, so a caller that wants to re-queue or count
     * what it lost reads one return value.
     */
    push(item: T): T | undefined;
    /**
     * Append only if there is room, reporting whether the item was admitted. `false`
     * means the ring is full and refuses; under `drop-oldest` an item is always
     * admitted, because that policy pays for admission with an eviction.
     */
    tryPush(item: T): boolean;
    /** Remove and return the oldest item — the dequeue half of {@link push}. */
    shift(): T | undefined;
    clear(): void;
    first(): T | undefined;
    last(): T | undefined;
    /** The most recent `n` items, oldest first. */
    tail(n?: number): T[];
    toArray(): T[];
    filter(predicate: (item: T) => boolean): T[];
    reduce<A>(accumulator: (acc: A, item: T) => A, initial: A): A;
    /**
     * Oldest first, live.
     */
    [Symbol.iterator](): IterableIterator<T>;
}
/**
 * Drop-oldest push for plain arrays. One `shift()` per overflow — no `splice`
 * reallocation and no cap arithmetic repeated at the call site. Returns the
 * displaced item, which is what a sliding-window caller needs and what every
 * other caller ignores.
 */
export declare function pushCapped<T>(log: T[], item: T, capacity: number): T | undefined;
/**
 * Keep the newest `capacity` entries of a plain array, dropping from the front.
 * Returns how many were dropped, for the callers that report it. The in-place
 * counterpart of {@link takeLast}, for the callers that own the array.
 */
export declare function trimCapped<T>(log: T[], capacity: number): number;
/**
 * The newest `count` items, reading from the end.
 *
 * `slice(-n)` is the idiom for this and its twin `slice(0, n)` is the idiom for
 * the *oldest* `n`. They are the same length, one argument apart, and nothing at
 * the call site says which one is meant — so both were written in production code
 * and a reader could not tell a "most recent" read from a "first found" read
 * without counting the minus sign. The name is the point; `takeFirst` is the
 * other half.
 *
 * `count <= 0` yields nothing, matching {@link collectUpTo} and {@link shareOf}:
 * a limit of zero is a refusal to read, not a request for the whole list.
 */
export declare const takeLast: <T>(items: readonly T[], count: number) => T[];
/** The oldest `count` items — {@link takeLast} read from the other end. */
export declare const takeFirst: <T>(items: readonly T[], count: number) => T[];
/**
 * The first `limit` items `accept` admits, and nothing past them.
 *
 * The AIKR read primitive: a scan over an unbounded source that must not become
 * unbounded work, because the cost of a query is not allowed to scale with the
 * size of what it may return. Ten call sites had written the loop —
 * `push` then `if (length >= limit) break` — and the two ways it was wrong were
 * the two ways a hand-written loop is wrong: forgetting the break and scanning
 * the whole source anyway, and `break`ing on the *source* count so a run of
 * rejects could exhaust a large input for a short answer.
 *
 * A `limit` of zero collects nothing, which is the honest reading and the reason
 * this is one function rather than a `break` a caller may or may not reach.
 */
export declare const collectUpTo: <T, R = T>(items: Iterable<T>, limit: number, accept: (item: T) => R | undefined) => R[];
/**
 * How many items a share of a pool comes to — the arithmetic behind every
 * bounded slice, sampling window and holdout split, which each re-derived as
 * `max(1, floor(len * fraction))` (or `ceil`) and left the two roundings to
 * disagree across the tree.
 *
 * `floor` is what separates a *share* from *nothing*: a site that must always
 * make progress passes `1` (the default), and a site that must be faithful to a
 * zero share passes `0`.
 */
export declare const shareCount: (population: number, fraction: number, floor?: number, round?: (value: number) => number) => number;
/**
 * {@link shareCount} read backwards — how many items one of `parts` equal shares
 * of `whole` comes to, which is what stratifying a population into bands is.
 *
 * It has to stay a division rather than `shareCount(whole, 1 / parts)`: a
 * non-terminating reciprocal loses the quotient by one at every exact multiple
 * (`98 * (1/49)` is `1.999…`), which is a sampling window silently admitting half
 * of what it was sized for.
 */
export declare const perPart: (whole: number, parts: number, floor?: number, round?: (value: number) => number) => number;
/**
 * The first `fraction` of `items`, at least `count` and never all of them.
 *
 * Pressure relief always wants a *share* of a pool, and every site computed it as
 * `min(size, ceil(size * share))` followed by a slice — which is a cap and a
 * rounding rule, spelled out four times with the rounding left to differ. A share
 * of zero must yield nothing rather than the `count` floor, or a container under
 * no pressure sheds its minimum anyway.
 *
 * `population` is the pool the share is taken of when it is not `items` itself —
 * the case that made every site re-derive the arithmetic: "a tenth of the store",
 * cut from a candidate list that is smaller than the store.
 */
export declare const shareOf: <T>(items: readonly T[], fraction: number, count?: number, population?: number) => T[];
/** Fixed-size slices for batched work — the one chunking primitive. */
export declare const chunk: <T>(items: readonly T[], size: number) => T[][];
//# sourceMappingURL=ring-buffer.d.ts.map