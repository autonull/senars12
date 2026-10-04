/**
 * Deterministic seeded randomness — the single PRNG for reproducible sampling,
 * dataset splits, and imagination scenarios.
 *
 * Lives in `@senars/util` rather than beside its largest consumer because a
 * seeded source is a dependency of *every* layer that must be reproducible:
 * bag eviction, rate windows, dataset splits and imagination scenarios all draw
 * from one, and a layer below the reasoning engine had to reimplement mulberry32
 * or reach up to `nar` for it.
 */

/** Injectable randomness — a seeded stream, an LCG, or `Math.random`. */
export type RandomSource = () => number;

/**
 * The source a component falls back to when its caller names none.
 *
 * Seventeen constructors defaulted to `Math.random` inline, spread across the
 * registry, the bags, the reflexes, the RLFP learners and the tool manager — so
 * "which subsystems reach for ambient entropy" was an answer only a grep could
 * give, and a determinism gate had no single seam to assert against. One named
 * default is both stubbable in a test and readable in a diff.
 *
 * Forwards to `Math.random` rather than aliasing it, because the determinism
 * harness pins the global (`tests/helpers/rng.ts`) and an alias captured at
 * module load would silently opt those seventeen subsystems out of the pin.
 */
export const ambientRng: RandomSource = () => Math.random();

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

/**
 * A seed-or-source parameter resolved to a draw function: a bare function
 * passes through, a number pins a fresh mulberry32 stream, and `undefined`
 * falls back to `ambient`. One spelling for every `seed?: number | RandomSource`
 * constructor in the NAR (strategies, RL adapters, imagination, games).
 */
export const rngFrom = (
  seed: number | RandomSource | undefined,
  ambient: RandomSource = Math.random
): RandomSource =>
  seed === undefined ? ambient : typeof seed === 'function' ? seed : mulberry32(seed);

/**
 * Numerical-Recipes LCG — a second algorithm, not a second PRNG *policy*. It is
 * kept because the test suites pin `Math.random` to it and changing the stream
 * would silently move every seeded expectation; it lives here rather than in a
 * test helper so a production entrypoint can use it without importing vitest.
 */
export const createLCG = (seed = 0x2f6e2b1): RandomSource => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

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

/** Fill `out` with `[-1, 1)` draws from `seededStream` — the deterministic
 *  feature-block expansion behind per-action embeddings. A zero seed falls back
 *  to 1, matching the historical guard against a stuck all-zero stream. */
export const fillSeededUnitRange = (out: Float32Array, seed: number): Float32Array => {
  const next = seededStream(seed || 1).next;
  for (let i = 0; i < out.length; i++) out[i] = next() * 2 - 1;
  return out;
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

/** A candidate and the weight a draw gives it — the shape every weighted selection reads. */
export type Weighted<T> = { item: T; weight: number };

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

/**
 * The index of a weight-proportional draw over `count` slots, or -1 when the
 * pool is empty or carries no weight. The one weighted scan in the NAR: the
 * total is read off the pool itself rather than a cached scalar, so a stale
 * aggregate cannot skew the draw. Non-positive weights are never drawn.
 */
const weightedScan = (
  count: number,
  weightAt: (index: number) => number,
  rng: RandomSource
): number => {
  let total = 0;
  for (let i = 0; i < count; i++) {
    const weight = weightAt(i);
    if (weight > 0) total += weight;
  }
  if (total <= 0) return -1;
  let roll = rng() * total;
  for (let i = 0; i < count; i++) {
    const weight = weightAt(i);
    if (weight <= 0) continue;
    roll -= weight;
    if (roll <= 0) return i;
  }
  return count - 1;
};

/**
 * One weight-proportional item draw — the primitive behind every weighted
 * selection in the NAR (priority bags, focus scheduling, roulette sampling).
 * `undefined` means the pool has no weight to distribute, which each caller
 * already answers with its own fallback.
 */
export const weightedPick = <T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  rng: RandomSource
): T | undefined => {
  const index = weightedScan(items.length, (i) => weightOf(items[i]!), rng);
  return index < 0 ? undefined : items[index];
};

/** Weighted sampling over pre-computed weights — the O(n) draw behind `weightedSample`. */
export const weightedSampleBy = <T>(
  entries: readonly Weighted<T>[],
  count: number,
  rng: RandomSource
): T[] => {
  const pool = entries.filter((entry) => entry.weight > 0);
  // All-zero weights carry no information — fall back to source order.
  if (pool.length === 0) return entries.slice(0, count).map((entry) => entry.item);
  const picked: T[] = [];
  for (let draw = 0; draw < count && pool.length > 0; draw++) {
    const index = weightedScan(pool.length, (i) => pool[i]!.weight, rng);
    picked.push(pool.splice(index, 1)[0]!.item);
  }
  return picked;
};
