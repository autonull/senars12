export declare const joinKey: (...parts: readonly string[]) => string;
/**
 * The `parts` of a key {@link joinKey} wrote. Throws rather than returning
 * `undefined` for a key that was not written that way: a malformed key reaching a
 * consumer is a bug in the writer, and a `undefined` component would travel on as
 * a plausible string.
 */
export declare const splitKey: (key: string, parts: number) => string[];
/**
 * The narrowing a ranker may do around its sort.
 *
 * Each field removes a chained array stage that every caller otherwise spells
 * as its own `.filter().sort().slice()` pipeline.
 */
export interface RankOptions<T> {
    /**
     * Drop items before ranking. Receives the already-computed key, so a floor on
     * that key costs no second pass over the source.
     */
    readonly where?: (item: T, key: number) => boolean;
    /**
     * Secondary order for equal keys — the deterministic tie-break a caller needs
     * when the result must not depend on input order. Returning `0` falls back to
     * input order, so a partial tie-break is still stable.
     */
    readonly tiebreak?: (a: T, b: T) => number;
    /** Keep at most this many of the ranked items. */
    readonly limit?: number;
}
/** Decorate-sort-undecorate on a derived key — the shape both rankers share. */
export declare function keyedRank<T>(items: Iterable<T>, score: (item: T) => number, byKey: (a: number, b: number) => number, { where, tiebreak, limit }?: RankOptions<T>): T[];
/**
 * Top `n` items from an iterable ranked by `score`, descending. Single-pass with
 * a bounded buffer — avoids materializing or sorting the full input.
 *
 * `where` is the caller's own filter, applied during the scan rather than as a
 * `.filter()` ahead of it: the sites that needed one were all reading a
 * container's values and wanted the threshold on the same key the ranking uses,
 * so a pre-filter meant copying the whole source to hand it to this.
 */
export declare function selectTopN<T>(items: Iterable<T>, n: number, score: (item: T) => number, where?: (item: T) => boolean): T[];
/**
 * Greedy budget selection over `{ priority, id }` items: highest priority
 * first, ties broken by id, then capped at `budget`. Bounded-buffer selection
 * (O(n·budget) worst case) with the deterministic tie-break applied at insert
 * time, so the result never depends on input order.
 */
export declare function selectByPriority<T extends {
    priority: number;
    id: string;
}>(items: Iterable<T>, budget: number, eligible?: (item: T) => boolean): T[];
//# sourceMappingURL=iteration.d.ts.map