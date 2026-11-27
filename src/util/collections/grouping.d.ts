import type { ReadOnlyLookup } from './ring-buffer';
/**
 * The key of a `[key, value]` pair — the derivation a Map's own entries need
 * when they are handed to {@link keyedBy} or {@link indexBy} rather than to a
 * plain-object projection. Exported because "index this map by its own keys" is
 * the common case and the destructure was being restated at each one.
 */
export declare const entryKey: <K>([key]: readonly [K, unknown]) => K;
/**
 * Bucket `items` by a derived key, preserving encounter order within each
 * bucket. The lazy-bucket-plus-`getOrInsert` pair is the shape every
 * group-by-key site was hand-writing; expressed once, the call site is a single
 * declaration and the bucket type is inferred rather than repeated.
 */
export declare function groupBy<T, K>(items: Iterable<T>, key: (item: T) => K): Map<K, T[]>;
/**
 * {@link groupBy} without the keys — for the caller that buckets each group but
 * never looks a group up by its key, where keeping the map alive would be a
 * whole index retained for nothing. Each bucket keeps encounter order, so
 * `bucket[0]` is the first item seen for that key.
 */
export declare function buckets<T, K>(items: Iterable<T>, key: (item: T) => K): T[][];
/**
 * Index `items` by a derived key into a plain object — the record a lookup
 * table, a scope table or a per-name dispatch map is spelled by hand as
 * `Object.fromEntries(items.map(i => [i.id, i]))`. `PropertyKey` rather than
 * `string` so numeric keys keep object semantics instead of needing a cast,
 * and the value is `V` rather than `T` so a projection (`(r) => r.head`)
 * does not need a second pass.
 */
export declare function keyedBy<T, K extends PropertyKey, V = T>(items: Iterable<T>, key: (item: T) => K, value?: (item: T, key: K) => V): Record<K, V>;
/**
 * {@link keyedBy}'s `Map` twin — `new Map(items.map(i => [i.key, i]))`, which
 * eleven sites spelled out because `keyedBy` answered with a `Record` and a
 * lookup table does not have to be an object. Same derived key, same optional
 * projection, and the keys may be any `K` rather than a `PropertyKey`.
 */
export declare function indexBy<T, K, V = T>(items: Iterable<T>, key: (item: T) => K, value?: (item: T, key: K) => V): Map<K, V>;
/**
 * Entry pairs as a plain object, optionally projecting each value. A map's keys
 * are already unique and already the identity, so unlike {@link keyedBy} there
 * is no collision question — this is only ever the `Object.fromEntries` copy,
 * which exists to hand a keyed container to an API that speaks `Record`.
 *
 * Takes entries rather than a `Map` because a `Map` *is* an iterable of entries
 * and half the callers never had one: a query string, a freshly-mapped pair
 * list, a `URLSearchParams`. Naming the map type would have made each of them
 * re-spell the `Object.fromEntries` this replaces.
 */
export declare function mapToRecord<K extends PropertyKey, V, W = V>(source: Iterable<readonly [K, V]>, project?: (value: V, key: K) => W): Record<K, W>;
/**
 * {@link mapToRecord}'s `Map` twin — the `new Map([...map].map(...))` copy that
 * projects each value *with its own key*, which is the half of the idiom a
 * derived key cannot express.
 */
export declare function indexMap<K, V, W = V>(map: ReadOnlyLookup<K, V>, project?: (value: V, key: K) => W): Map<K, W>;
/**
 * Re-key a record's values while keeping its keys — the `Object.fromEntries(
 * Object.entries(r).map(([k, v]) => [k, project(v)]))` pair, which is a projection
 * wearing a copy's clothes: the keys are already right, only the values change.
 */
export declare function mapValues<K extends PropertyKey, V, W>(record: Readonly<Record<K, V>>, project: (value: V, key: K) => W): Record<K, W>;
//# sourceMappingURL=grouping.d.ts.map