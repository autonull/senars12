/**
 * Lazily-created map entry — the single get-or-create primitive for nested maps.
 *
 * `onInsert` fires only when this call is the one that created the entry, which
 * is the fact a memoizing caller needs and could not get: hand-writing the
 * `get`-then-`set` was the only way to distinguish a hit from a miss, so every
 * site that had to tell them apart carried its own copy of the branch.
 */
export function getOrInsert(map, key, factory, onInsert) {
    const existing = map.get(key);
    if (existing !== undefined)
        return existing;
    const created = factory();
    map.set(key, created);
    onInsert?.();
    return created;
}
/**
 * {@link getOrInsert} plus the write-back: read the record under `key`, mint it
 * with `zero` on first use, let `apply` add to it, store it, and hand it back.
 *
 * The running tally that eight subsystems keep — LM spend per provider, per-tier
 * dispatch latency, per-action episode reward, per-key preference score, source
 * reputation, per-concept staleness. Each wrote the same four lines:
 * `get(key) ?? { …zeros }`, mutate two or three counters, `set(key, entry)`. The
 * `??` is the whole risk and it is invisible at a glance: without it a site
 * throws on first contact, with it the branch is one duplicated decision per
 * subsystem and a fifth subsystem writes it wrong.
 *
 * Mutating the record in place rather than storing a rebuilt copy is what makes
 * this an accumulator and not a `map`: the hot callers run once per dispatched
 * query, per inference task and per distilled row, so this allocates nothing per
 * event. It is also why {@link apply} returns nothing — the entry the caller
 * gets back *is* the stored one, so a site that needs the running total after
 * adding to it (a spend compared against its cap) reads it without a third
 * lookup. `A` is constrained to an object for the same reason: a primitive would
 * make every `apply` a silent no-op, which is the one failure this function must
 * not have. A site that wants a fresh record per event rather than a tally uses
 * `map` instead.
 */
export function accumulate(store, key, zero, apply) {
    const existing = store.get(key);
    const entry = existing ?? zero();
    apply(entry);
    store.set(key, entry);
    return entry;
}
/**
 * Accumulate a per-key count; returns the new total. Takes a {@link KeyedStore}
 * so a bounded cache can count as well as a `Map` — the aging counters behind
 * AIKR sampling live in an `LruCache`, and a `Map`-only signature left that site
 * re-deriving the `?? 0` it already had.
 */
export function incrementCount(map, key, delta = 1) {
    const next = (map.get(key) ?? 0) + delta;
    map.set(key, next);
    return next;
}
/**
 * Add to a per-key set, creating the set on first use.
 *
 * Takes {@link KeyedStore} rather than `Map` so a structurally-keyed store can
 * use it — `TermMap` keys by structural term equality and is the memory
 * system's primary index, so requiring a `Map` here left it re-implementing the
 * lazy-bucket-plus-add that this exists to be.
 */
export function addToSet(map, key, value) {
    let bucket = map.get(key);
    if (bucket === undefined) {
        bucket = new Set();
        map.set(key, bucket);
    }
    bucket.add(value);
}
/** Remove from a per-key set, dropping the key once its set empties — otherwise an
 *  index over concepts or links accumulates a bucket per key ever seen. */
export function removeFromSet(map, key, value) {
    const bucket = map.get(key);
    if (!bucket)
        return;
    bucket.delete(value);
    if (bucket.size === 0)
        map.delete(key);
}
/**
 * Value-level dedup, first occurrence wins. For "the set of concepts this event
 * touched" over a bag that may already hold duplicates — `[...new Set(xs)]` is
 * correct but says nothing about intent, and at seven call sites it read as a
 * different operation each time.
 */
export function unique(items) {
    return [...new Set(items)];
}
/**
 * First item per derived key — {@link unique} for a collection whose duplicates
 * are not value-equal but *key*-equal.
 *
 * A term canonicaliser asking "have I seen this shape", a lineage union asking
 * "have I seen this derivation id", a context assembler asking "have I already
 * reported this concept". Each is a `Set` guard inside a `filter`, so the filter
 * predicate carried a side effect and the dedupe could not be composed: a caller
 * that wanted to filter *and* dedupe wrote the guard by hand, and one that wanted
 * only to dedupe wrote a different guard by hand.
 *
 * `key` is evaluated once per item, so a structural key over a term tree is paid
 * once rather than once per comparison the way an equality predicate would be.
 */
export function uniqueBy(items, key) {
    const seen = new Set();
    const kept = [];
    for (const item of items) {
        const k = key(item);
        if (seen.has(k))
            continue;
        seen.add(k);
        kept.push(item);
    }
    return kept;
}
/** {@link unique} across several collections — the union an index query needs. */
export function flatUnique(collections) {
    return unique(collections.flat());
}
/**
 * Remove and return the first match, or `undefined` when nothing matched — and
 * leave the array untouched when nothing did.
 *
 * The `findIndex`-then-`splice` pair, hand-written at every site that also needs
 * the removed item, discovers "absent" only *after* mutating: `splice(-1, 1)`
 * removes the **last** element, so a miss silently destroyed an unrelated entry
 * while the caller reported that nothing happened. Returning the entry is what
 * makes the correct order expressible — decide, then mutate — and it spares the
 * caller a second search over the array it just changed.
 */
export function removeBy(items, predicate) {
    return removeByFrom(items, predicate, false);
}
/** {@link removeBy} scanning backwards, for a stack discipline: the most recent
 *  match, so a stage opened twice closes in the order it was opened. */
export function removeLastBy(items, predicate) {
    return removeByFrom(items, predicate, true);
}
function removeByFrom(items, predicate, fromLast) {
    const index = fromLast ? items.findLastIndex(predicate) : items.findIndex(predicate);
    return index < 0 ? undefined : items.splice(index, 1)[0];
}
/**
 * The last row per key, in first-appearance order. The dedupe half of every
 * append-only compaction: a later row is a *correction* of the earlier one, so
 * the earlier is the one that goes — which both compactions were asserting while
 * writing the map by hand, one of them also counting the rows it displaced and
 * the other deriving that count a different way.
 */
export const lastByKey = (rows, keyOf) => {
    const byKey = new Map();
    for (const row of rows)
        byKey.set(keyOf(row), row);
    return byKey;
};
