/** Fast non-cryptographic 32-bit hashes — the canonical primitives for cache
 *  keys, jitter derivation, and stable term/atom identity. Digests that must be
 *  tamper-evident belong in the SHA-256 helpers, not here. */
/** 32-bit multiply — without it the accumulator escapes 2^53 and loses precision. */
export declare const mul32: (a: number, b: number) => number;
/** FNV-1a over a string. */
export declare const fnv1a: (str: string) => number;
/** FNV-1a combine step for compound terms. */
export declare const fnv1aCombine: (acc: number, val: number) => number;
/** Murmur3-finalizer fold of a string onto a caller seed — the string→u32 path
 *  behind seeded feature blocks. Kept beside `fnv1a` so seeded and unseeded
 *  string hashing share one home rather than one hand-rolled loop per caller. */
export declare const seededStringHash: (value: string, seed: number) => number;
/** One djb2 step — for folding non-string values (floats, salts) into a hash. */
export declare const djb2Step: (hash: number, value: number) => number;
/** djb2 over a string, with an optional per-character salt. */
export declare const djb2: (str: string, salt?: number) => number;
export type DigestInput = string | Uint8Array;
/** SHA-256 hex digest — the single hashing entry point for digests and provenance keys. */
export declare const sha256Hex: (data: DigestInput) => string;
/**
 * Streaming SHA-256 hex digest over an ordered list of parts.
 *
 * Each part is length-prefixed rather than concatenated, so `['ab', 'c']` and
 * `['a', 'bc']` are two different inputs. A digest of a tuple that can be spelled
 * two ways is not an identity — which is why every caller wanting a tuple digest
 * first had to pick a separator, and why three of them picked three.
 */
export declare const sha256HexParts: (parts: readonly DigestInput[]) => string;
/** Algorithm-pinned digest form (`sha256:<hex>`) used by ModelDigest, lock files, and dialogue digests. */
export declare const sha256Prefixed: (data: DigestInput) => string;
/** Canonical pinned-digest shape (`sha256:<64 lowercase hex>`) — ModelDigest, lock files. */
export declare const SHA256_PINNED: RegExp;
/** Truncated digest for compact identity keys (sidecars, consolidation ids). */
export declare const shortSha256Hex: (data: DigestInput, length?: number) => string;
//# sourceMappingURL=hash.d.ts.map