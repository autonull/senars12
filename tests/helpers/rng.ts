/**
 * Deterministic RNG for tests (TODO20 T1/T2). Pins the global `Math.random`
 * stream to a seeded LCG so Bag sampling and exploratory policies stop
 * depending on module-load order — and restores it afterwards.
 */
import { vi } from 'vitest';
import type { RandomSource } from '../../nar/src/types/primitives.js';

export type { RandomSource };

/** Seeded LCG (Numerical Recipes constants) — same seed ⇒ same stream. */
export const createLCG = (seed = 0x2f6e2b1): RandomSource => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

let unpinned: (() => void) | null = null;

/** Pin global Math.random to a deterministic LCG stream (idempotent). */
export const pinDeterministicRNG = (seed?: number): RandomSource => {
  restoreRNG();
  const lcg = createLCG(seed);
  const spy = vi.spyOn(Math, 'random').mockImplementation(lcg);
  unpinned = () => spy.mockRestore();
  return lcg;
};

/** Restore the original Math.random (no-op when not pinned). */
export const restoreRNG = (): void => {
  unpinned?.();
  unpinned = null;
};

/** Run fn with Math.random pinned to a seeded LCG; always restores. */
export const withDeterministicRNG = async <T>(
  fn: (rng: RandomSource) => T | Promise<T>,
  seed?: number
): Promise<T> => {
  pinDeterministicRNG(seed);
  try {
    return await fn(createLCG(seed));
  } finally {
    restoreRNG();
  }
};
