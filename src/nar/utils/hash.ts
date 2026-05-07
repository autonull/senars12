/**
 * Hash utilities for term hashing and identification
 */

/**
 * FNV-1a 32-bit hash function
 */
export const fnv1a = (str: string): number => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

/**
 * FNV-1a combine operation for compound terms
 */
export const fnv1aCombine = (acc: number, val: number): number =>
    Math.imul(acc ^ val, 0x01000193) >>> 0;

export const computeHash = (kind: string, argHashes: number[]): number =>
    argHashes.toSorted((a, b) => a - b).reduce((acc, h) => fnv1aCombine(acc, h), fnv1a(kind));
