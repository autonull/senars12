/** The membership-and-size surface a set-overlap score needs; `Set` and `TermSet` both satisfy it. */
export interface ReadonlySetLike<T> {
    readonly size: number;
    has(value: T): boolean;
    forEach(callbackfn: (value: T) => void): void;
}
export declare const jaccard: <T>(a: ReadonlySetLike<T>, b: ReadonlySetLike<T>) => number;
/** Cosine similarity over any numeric vectors (dense embeddings, feature blocks).
 *  Mismatched lengths compare the shared prefix — dimension mismatches are a
 *  caller bug, and truncating beats silently scoring every pair as 0. */
export declare const cosine: (a: ArrayLike<number>, b: ArrayLike<number>) => number;
/**
 * Cosine between two vectors already reduced to unit length by
 * {@link l2Normalize} — the dot product, with no norm pass.
 *
 * One candidate scored against many kept vectors spends its own norm once per
 * comparison, and each kept vector's norm once per candidate. Normalising on
 * insert and on arrival turns that O(n·m·dim) norm arithmetic into O((n+m)·dim).
 * A zero vector normalises to itself and so scores 0, as it does under
 * {@link cosine}.
 */
export declare const cosineUnit: (a: ArrayLike<number>, b: ArrayLike<number>) => number;
/** Unit-length copy of `v`; a zero vector passes through unchanged. */
export declare const l2Normalize: <V extends ArrayLike<number>>(v: V) => number[];
/**
 * A vector with its norm already known. Scoring one query against a bag of
 * exemplars re-derives the query's norm once per comparison otherwise, which
 * is O(n·dim) redundant work on the hottest path in the manifold.
 */
export interface NormalizedVector {
    readonly values: ArrayLike<number>;
    readonly norm: number;
}
export declare const normalize: (v: ArrayLike<number>) => NormalizedVector;
/** Cosine against a pre-measured query — identical to {@link cosine}, minus the
 *  query's redundant norm pass. A zero query or candidate scores 0. */
export declare const cosineNormalized: (a: NormalizedVector, b: ArrayLike<number>) => number;
//# sourceMappingURL=similarity.d.ts.map