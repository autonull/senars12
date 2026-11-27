import { createHash } from 'node:crypto';
/** Fast non-cryptographic 32-bit hashes — the canonical primitives for cache
 *  keys, jitter derivation, and stable term/atom identity. Digests that must be
 *  tamper-evident belong in the SHA-256 helpers, not here. */
/** 32-bit multiply — without it the accumulator escapes 2^53 and loses precision. */
export const mul32 = (a, b) => Math.imul(a, b);
/** FNV-1a over a string. */
export const fnv1a = (str) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = mul32(hash, 0x01000193);
    }
    return hash >>> 0;
};
/** FNV-1a combine step for compound terms. */
export const fnv1aCombine = (acc, val) => mul32(acc ^ val, 0x01000193) >>> 0;
/** Murmur3-finalizer fold of a string onto a caller seed — the string→u32 path
 *  behind seeded feature blocks. Kept beside `fnv1a` so seeded and unseeded
 *  string hashing share one home rather than one hand-rolled loop per caller. */
export const seededStringHash = (value, seed) => {
    let hash = seed >>> 0;
    for (let i = 0; i < value.length; i++)
        hash = mul32(hash ^ value.charCodeAt(i), 0x85ebca6b) >>> 0;
    return hash;
};
/** One djb2 step — for folding non-string values (floats, salts) into a hash. */
export const djb2Step = (hash, value) => ((hash << 5) - hash + value) | 0;
/** djb2 over a string, with an optional per-character salt. */
export const djb2 = (str, salt = 0) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++)
        hash = djb2Step(hash, str.charCodeAt(i) + salt);
    return hash;
};
const SHA256_ALGORITHM = 'sha256';
/** SHA-256 hex digest — the single hashing entry point for digests and provenance keys. */
export const sha256Hex = (data) => createHash(SHA256_ALGORITHM).update(data).digest('hex');
/**
 * Streaming SHA-256 hex digest over an ordered list of parts.
 *
 * Each part is length-prefixed rather than concatenated, so `['ab', 'c']` and
 * `['a', 'bc']` are two different inputs. A digest of a tuple that can be spelled
 * two ways is not an identity — which is why every caller wanting a tuple digest
 * first had to pick a separator, and why three of them picked three.
 */
export const sha256HexParts = (parts) => {
    const hash = createHash(SHA256_ALGORITHM);
    for (const part of parts) {
        hash.update(`${typeof part === 'string' ? Buffer.byteLength(part) : part.length}:`);
        hash.update(part);
    }
    return hash.digest('hex');
};
/** Algorithm-pinned digest form (`sha256:<hex>`) used by ModelDigest, lock files, and dialogue digests. */
export const sha256Prefixed = (data) => `sha256:${sha256Hex(data)}`;
/** Canonical pinned-digest shape (`sha256:<64 lowercase hex>`) — ModelDigest, lock files. */
export const SHA256_PINNED = /^sha256:[0-9a-f]{64}$/;
/** Truncated digest for compact identity keys (sidecars, consolidation ids). */
export const shortSha256Hex = (data, length = 16) => sha256Hex(data).slice(0, length);
