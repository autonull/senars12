/**
 * Deterministic seeded randomness — the single PRNG for reproducible sampling,
 * dataset splits, and imagination scenarios.
 */

import type { RandomSource } from '../types/primitives.js';

/** A resumable mulberry32 stream: the draw function plus its live 32-bit state word. */
export interface SeededStream {
  readonly next: RandomSource;
  readonly state: () => number;
}

/**
 * mulberry32 as a resumable stream. The state word is the only thing separating
 * position N from position N+k, so exposing it is what makes a mid-run
 * checkpoint (`SeededRNG.getState`) restore an exact continuation rather than
 * restarting the sequence from its seed.
 */
export const seededStream = (seed: number): SeededStream => {
  let a = seed >>> 0;
  return {
    next: () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state: () => a,
  };
};

/** mulberry32: fast, well-distributed 32-bit seeded PRNG. */
export const mulberry32 = (seed: number): RandomSource => seededStream(seed).next;

/** Random integer in [0, max). */
export const nextInt = (rng: RandomSource, max: number): number => Math.floor(rng() * max);

/** Random element; throws on empty input. */
export const choice = <T>(rng: RandomSource, items: readonly T[]): T => {
  const picked = items[nextInt(rng, items.length)];
  if (picked === undefined) throw new RangeError('choice from empty array');
  return picked;
};

/**
 * Stateful handle over the canonical `mulberry32` stream — the same PRNG as a
 * resettable object, for call sites that thread an RNG through constructors.
 * `getState`/`setState` checkpoint and restore the exact draw position, which is
 * what makes cloned games and RL baseline snapshots resume identically.
 */
export class SeededRNG {
  #stream: SeededStream;

  constructor(seed: number = 1) {
    this.#stream = seededStream(seed);
  }

  /** Random float in [0, 1). */
  readonly next = (): number => this.#stream.next();

  /** Adapter for utilities taking a bare `RandomSource` (e.g. `shuffleInPlace`). */
  readonly source: RandomSource = () => this.#stream.next();

  /** Random integer in [0, max). */
  nextInt(max: number): number {
    return nextInt(this.#stream.next, max);
  }

  /** Random element; throws on empty input. */
  choice<T>(items: readonly T[]): T {
    return choice(this.#stream.next, items);
  }

  getState(): number {
    return this.#stream.state();
  }

  setState(state: number): void {
    this.#stream = seededStream(state);
  }
}

/** In-place Fisher–Yates shuffle — the single uniform-shuffle primitive (sampling, bags, exploration). */
export const shuffleInPlace = <T>(items: T[], rng: RandomSource): T[] => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
};

/**
 * Deterministic train/holdout partition — shuffles uniformly, then cuts a
 * `fraction`-sized holdout of at least one row. The single split primitive
 * behind head training, shared-head bake-off, and calibration fitting, so no
 * caller resorts to a biased `sort(() => rng() - 0.5)` shuffle.
 */
export const holdoutSplit = <T>(
  items: readonly T[],
  fraction: number,
  rng: RandomSource
): { holdout: T[]; train: T[] } => {
  const shuffled = shuffleInPlace([...items], rng);
  const cut = Math.min(shuffled.length, Math.max(1, Math.floor(shuffled.length * fraction)));
  return { holdout: shuffled.slice(0, cut), train: shuffled.slice(cut) };
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
