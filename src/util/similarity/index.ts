/** @public Vector and set similarity functions (cosine, Jaccard, L2 normalization). */
export type { NormalizedVector, ReadonlySetLike } from '../similarity';
export {
  cosine,
  cosineNormalized,
  cosineUnit,
  jaccard,
  l2Normalize,
  normalize,
} from '../similarity';