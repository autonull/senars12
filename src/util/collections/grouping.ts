import type { KeyedStore } from './ring-buffer';
import type { ReadOnlyLookup } from './ring-buffer';

/**
 * The key of a `[key, value]` pair — the derivation a Map's own entries need
 * when they are handed to {@link keyedBy} or {@link indexBy} rather than to a
 * plain-object projection. Exported because "index this map by its own keys" is
 * the common case and the destructure was being restated at each one.
 */
export const entryKey = <K>([key]: readonly [K, unknown]): K => key;

/**
 * Bucket `items` by a derived key, preserving encounter order within each
 * bucket. The lazy-bucket-plus-`getOrInsert` pair is the shape every
 * group-by-key site was hand-writing; expressed once, the call site is a single
 * declaration and the bucket type is inferred rather than repeated.
 */
export function groupBy<T, K>(items: Iterable<T>, key: (item: T) => K): Map<K, T[]> {
  const buckets = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = buckets.get(k);
    if (bucket) bucket.push(item);
    else buckets.set(k, [item]);
  }
  return buckets;
}

/**
 * {@link groupBy} without the keys — for the caller that buckets each group but
 * never looks a group up by its key, where keeping the map alive would be a
 * whole index retained for nothing. Each bucket keeps encounter order, so
 * `bucket[0]` is the first item seen for that key.
 */
export function buckets<T, K>(items: Iterable<T>, key: (item: T) => K): T[][] {
  return [...groupBy(items, key).values()];
}

/**
 * Index `items` by a derived key into a plain object — the record a lookup
 * table, a scope table or a per-name dispatch map is spelled by hand as
 * `Object.fromEntries(items.map(i => [i.id, i]))`. `PropertyKey` rather than
 * `string` so numeric keys keep object semantics instead of needing a cast,
 * and the value is `V` rather than `T` so a projection (`(r) => r.head`)
 * does not need a second pass.
 */
export function keyedBy<T, K extends PropertyKey, V = T>(
  items: Iterable<T>,
  key: (item: T) => K,
  value: (item: T, key: K) => V = (item) => item as unknown as V
): Record<K, V> {
  const record = {} as Record<K, V>;
  for (const item of items) {
    const k = key(item);
    record[k] = value(item, k);
  }
  return record;
}

/**
 * {@link keyedBy}'s `Map` twin — `new Map(items.map(i => [i.key, i]))`, which
 * eleven sites spelled out because `keyedBy` answered with a `Record` and a
 * lookup table does not have to be an object. Same derived key, same optional
 * projection, and the keys may be any `K` rather than a `PropertyKey`.
 */
export function indexBy<T, K, V = T>(
  items: Iterable<T>,
  key: (item: T) => K,
  value: (item: T, key: K) => V = (item) => item as unknown as V
): Map<K, V> {
  const index = new Map<K, V>();
  for (const item of items) {
    const k = key(item);
    index.set(k, value(item, k));
  }
  return index;
}

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
export function mapToRecord<K extends PropertyKey, V, W = V>(
  source: Iterable<readonly [K, V]>,
  project: (value: V, key: K) => W = (value) => value as unknown as W
): Record<K, W> {
  return keyedBy(source, entryKey<K>, ([, value], key) => project(value, key));
}

/**
 * {@link mapToRecord}'s `Map` twin — the `new Map([...map].map(...))` copy that
 * projects each value *with its own key*, which is the half of the idiom a
 * derived key cannot express.
 */
export function indexMap<K, V, W = V>(
  map: ReadOnlyLookup<K, V>,
  project: (value: V, key: K) => W = (value) => value as unknown as W
): Map<K, W> {
  return indexBy(map, entryKey<K>, ([, value], key) => project(value, key));
}

/**
 * Re-key a record's values while keeping its keys — the `Object.fromEntries(
 * Object.entries(r).map(([k, v]) => [k, project(v)]))` pair, which is a projection
 * wearing a copy's clothes: the keys are already right, only the values change.
 */
export function mapValues<K extends PropertyKey, V, W>(
  record: Readonly<Record<K, V>>,
  project: (value: V, key: K) => W
): Record<K, W> {
  const keys = Object.keys(record) as K[];
  return keyedBy(
    keys,
    (key) => key,
    (key) => project(record[key]!, key)
  );
}