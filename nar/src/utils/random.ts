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

/**
 * Weighted sampling without replacement (roulette wheel) — the single
 * selection primitive behind priority-proportional, softmax, and windowed
 * sampling. Each draw renormalizes over the remaining pool, so the returned
 * `count` items are drawn from successively smaller populations.
 */
export const weightedSample = <T>(
  items: readonly T[],
  count: number,
  weightOf: (item: T) => number,
  rng: RandomSource
): T[] => weightedSampleBy(items.map((item) => ({ item, weight: weightOf(item) })), count, rng);

/** Weighted sampling over pre-computed weights — the O(n) draw behind `weightedSample`. */
export const weightedSampleBy = <T>(
  entries: readonly { item: T; weight: number }[],
  count: number,
  rng: RandomSource
): T[] => {
  const positive = entries.filter((entry) => entry.weight > 0);
  // All-zero weights carry no information — fall back to source order.
  const pool = positive.length > 0 ? positive : entries.slice();
  const picked: T[] = [];
  for (let draw = 0; draw < count && pool.length > 0; draw++) {
    let total = 0;
    for (const entry of pool) total += entry.weight;
    let r = rng() * total;
    let index = 0;
    for (; index < pool.length; index++) {
      r -= pool[index]!.weight;
      if (r <= 0) break;
    }
    picked.push(pool.splice(Math.min(index, pool.length - 1), 1)[0]!.item);
  }
  return picked;
};
