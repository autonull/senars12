/**
 * Hash utilities for term hashing and identification.
 *
 * Primitives and SHA-256 digests live in `@senars/util`; this module keeps the
 * term-specific `computeHash` canonicalization alongside the re-exports.
 */

import { djb2, djb2Step, fnv1a, fnv1aCombine, mul32 } from '@senars/util';

export { djb2, djb2Step, fnv1a, fnv1aCombine, mul32 };
export { sha256Hex, sha256HexParts, sha256Prefixed, shortSha256Hex } from '@senars/util';
export type { DigestInput } from '@senars/util';

const COMMUTATIVE_OPS = new Set(['similarity', 'conjunction', 'disjunction', 'equivalence']);

export const computeHash = (kind: string, argHashes: number[]): number => {
  const hashes = COMMUTATIVE_OPS.has(kind) ? [...argHashes].sort((a, b) => a - b) : argHashes;
  return hashes.reduce((acc, h) => fnv1aCombine(acc, h), fnv1a(kind));
};
