export const jaccard = <T>(a: Set<T>, b: Set<T>): number => {
  if (a.size === 0 && b.size === 0) return 0;
  const inter = [...a].filter((x) => b.has(x)).length;
  return inter / (a.size + b.size - inter || 1);
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
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

/** Unit-length copy of `v`; a zero vector passes through unchanged. */
export const l2Normalize = <V extends ArrayLike<number>>(v: V): number[] => {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += (v[i] ?? 0) ** 2;
  const scale = Math.sqrt(norm) || 1;
  return Array.from({ length: v.length }, (_, i) => (v[i] ?? 0) / scale);
};
