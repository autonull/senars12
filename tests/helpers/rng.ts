/**
 * Deterministic RNG for tests (TODO20 T1/T2). Pins the global `Math.random`
 * stream to a seeded LCG so Bag sampling and exploratory policies stop
 * depending on module-load order — and restores it afterwards.
 *
 * The LCG itself lives in `@senars/util`: a production entrypoint
 * (`scripts/fuzz-narsese.ts`) seeds from it too, and that script must not pull
 * vitest in through a test helper.
 */
import { createLCG, type RandomSource } from '@senars/util';
import { vi } from 'vitest';

export type { RandomSource };
export { createLCG };

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
