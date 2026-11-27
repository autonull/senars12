/** The one edge identity between two term keys. */
const edgeKey = (source, target) => `${source}->${target}`;
/**
 * Composite keys: the join and the split, so a key that is written in two places
 * is parsed in one.
 *
 * A `scope::name` or `action::kind` pair appeared as a template literal at the
 * write and a hand-rolled `split(sep)[i]` at the read, in each case with the
 * separator written out again. Changing the separator then meant finding every
 * reader of every key, and a reader that split on the wrong index got a plausible
 * wrong answer instead of an error. Here the separator and the arity live in one
 * declaration, and {@link splitKey} takes the count so it cannot silently accept
 * a key of the wrong shape. A part must not itself contain the separator — the
 * pair is a split, not a quote, and {@link splitKey} reports the arity it found
 * rather than quietly returning a part with the separator still in it.
 */
const KEY_SEPARATOR = '::';
export const joinKey = (...parts) => parts.join(KEY_SEPARATOR);
/**
 * The `parts` of a key {@link joinKey} wrote. Throws rather than returning
 * `undefined` for a key that was not written that way: a malformed key reaching a
 * consumer is a bug in the writer, and a `undefined` component would travel on as
 * a plausible string.
 */
export const splitKey = (key, parts) => {
    const split = key.split(KEY_SEPARATOR);
    if (split.length !== parts) {
        throw new Error(`key '${key}' has ${split.length} parts, expected ${parts}`);
    }
    return split;
};
/** Decorate-sort-undecorate on a derived key — the shape both rankers share. */
export function keyedRank(items, score, byKey, { where, tiebreak, limit } = {}) {
    const keyed = [];
    for (const item of items) {
        const key = score(item);
        if (where !== undefined && !where(item, key))
            continue;
        keyed.push({ item, key });
    }
    keyed.sort((a, b) => byKey(a.key, b.key) || (tiebreak?.(a.item, b.item) ?? 0));
    const kept = limit === undefined ? keyed : keyed.slice(0, Math.max(0, limit));
    return kept.map(({ item }) => item);
}
/**
 * Top `n` items from an iterable ranked by `score`, descending. Single-pass with
 * a bounded buffer — avoids materializing or sorting the full input.
 *
 * `where` is the caller's own filter, applied during the scan rather than as a
 * `.filter()` ahead of it: the sites that needed one were all reading a
 * container's values and wanted the threshold on the same key the ranking uses,
 * so a pre-filter meant copying the whole source to hand it to this.
 */
export function selectTopN(items, n, score, where = () => true) {
    return selectBest(items, n, score, (a, b) => a > b, where);
}
/**
 * Greedy budget selection over `{ priority, id }` items: highest priority
 * first, ties broken by id, then capped at `budget`. Bounded-buffer selection
 * (O(n·budget) worst case) with the deterministic tie-break applied at insert
 * time, so the result never depends on input order.
 */
export function selectByPriority(items, budget, eligible = () => true) {
    return selectBest(items, budget, (item) => item, (a, b) => a.priority > b.priority || (a.priority === b.priority && a.id < b.id), eligible);
}
/**
 * The one bounded-buffer selection: keep the `n` best keys the scan has seen,
 * held descending, in a buffer that never grows past `n`.
 *
 * `better` is a total order over keys rather than a numeric score, which is what
 * let {@link selectByPriority} become this instead of a second implementation of
 * the same buffer: priority-plus-id cannot be one number, so it had to hand-roll
 * the insert-walk, the evict-worst slot and the final sort, and a fourth caller
 * wanting the same bound would have written a third. `key` is separate from
 * `better` so a numeric ranking still evaluates its score once per item rather
 * than once per comparison.
 *
 * Nothing is materialized or sorted in full, which is the point: this runs over
 * concept stores, Q-table rows and pending-task maps under an AIKR budget.
 */
function selectBest(items, n, key, better, eligible) {
    if (n <= 0)
        return [];
    const kept = [];
    const keys = [];
    // Fast path: when eligible is always true, avoid function call overhead
    const hasFilter = eligible !== (() => true) && eligible.length > 0;
    if (hasFilter) {
        for (const item of items) {
            if (!eligible(item))
                continue;
            const k = key(item);
            insertOrBubble(kept, keys, item, k, n, better);
        }
    }
    else {
        for (const item of items) {
            const k = key(item);
            insertOrBubble(kept, keys, item, k, n, better);
        }
    }
    return kept;
}
function insertOrBubble(kept, keys, item, k, n, better) {
    if (kept.length === n) {
        if (!better(k, keys[n - 1]))
            return;
        kept[n - 1] = item;
        keys[n - 1] = k;
    }
    else {
        kept.push(item);
        keys.push(k);
    }
    let i = kept.length - 1;
    while (i > 0 && better(k, keys[i - 1])) {
        kept[i] = kept[i - 1];
        keys[i] = keys[i - 1];
        i--;
    }
    kept[i] = item;
    keys[i] = k;
}
