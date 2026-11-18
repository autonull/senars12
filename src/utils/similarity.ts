import { safeRatio } from '@senars/util';

/** The membership-and-size surface a set-overlap score needs; `Set` and `TermSet` both satisfy it. */
export interface ReadonlySetLike<T> {
  readonly size: number;
  has(value: T): boolean;
  forEach(callbackfn: (value: T) => void): void;
}

export const jaccard = <T>(a: ReadonlySetLike<T>, b: ReadonlySetLike<T>): number => {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  // Iterate the smaller set; membership is O(1) on the larger.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  small.forEach((x) => {
    if (large.has(x)) inter++;
  });
  return safeRatio(inter, a.size + b.size - inter);
};

/** Cosine similarity over any numeric vectors (dense embeddings, feature blocks).
 *  Mismatched lengths compare the shared prefix — dimension mismatches are a
 *  caller bug, and truncating beats silently scoring every pair as 0. */
export const cosine = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return safeRatio(dot, Math.sqrt(normA) * Math.sqrt(normB));
};

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
export const cosineUnit = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
};

/** Euclidean length of `v`; a zero vector measures 0. */
const normOf = (v: ArrayLike<number>): number => {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += (v[i] ?? 0) ** 2;
  return Math.sqrt(sum);
};

/** Unit-length copy of `v`; a zero vector passes through unchanged. */
export const l2Normalize = <V extends ArrayLike<number>>(v: V): number[] => {
  const scale = normOf(v) || 1;
  return Array.from({ length: v.length }, (_, i) => (v[i] ?? 0) / scale);
};

/**
 * A vector with its norm already known. Scoring one query against a bag of
 * exemplars re-derives the query's norm once per comparison otherwise, which
 * is O(n·dim) redundant work on the hottest path in the manifold.
 */
export interface NormalizedVector {
  readonly values: ArrayLike<number>;
  readonly norm: number;
}

export const normalize = (v: ArrayLike<number>): NormalizedVector => ({
  values: v,
  norm: normOf(v),
});

/** Cosine against a pre-measured query — identical to {@link cosine}, minus the
 *  query's redundant norm pass. A zero query or candidate scores 0. */
export const cosineNormalized = (a: NormalizedVector, b: ArrayLike<number>): number => {
  if (a.norm === 0) return 0;
  const n = Math.min(a.values.length, b.length);
  let dot = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    const y = b[i] ?? 0;
    dot += (a.values[i] ?? 0) * y;
    normB += y * y;
  }
  return safeRatio(dot, a.norm * Math.sqrt(normB));
};
