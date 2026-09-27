/**
 * Deterministic seeded randomness — the single PRNG for reproducible sampling,
 * dataset splits, and imagination scenarios.
 */

import type { RandomSource } from '../types/primitives.js';

/** mulberry32: fast, well-distributed 32-bit seeded PRNG. */
export const mulberry32 = (seed: number): RandomSource => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
