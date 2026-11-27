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
export declare const ambientRng: RandomSource;
/**
 * A `RandomSource` whose position is a value — the shape a checkpoint round-trips.
 * `SeededRNG` is the canonical implementation; anything with an equivalent
 * `source`/`getState`/`setState` triple qualifies, so a caller can hand the kernel
 * a resumable stream without importing the class.
 */
export interface StatefulRandomSource {
    readonly source: RandomSource;
    getState(): number;
    setState(state: number): void;
}
/** Whether `value` is a stateful source whose draw position can be checkpointed. */
export declare const isStatefulRandomSource: (value: unknown) => value is StatefulRandomSource;
/** A stateful source reduced to its bare draw function; a plain source passes through. */
export declare const randomSourceOf: (value: RandomSource | StatefulRandomSource | undefined) => RandomSource | undefined;
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
export declare const seededStream: (seed: number) => SeededStream;
/** mulberry32: fast, well-distributed 32-bit seeded PRNG. */
export declare const mulberry32: (seed: number) => RandomSource;
/**
 * A seed-or-source parameter resolved to a draw function: a bare function
 * passes through, a number pins a fresh mulberry32 stream, and `undefined`
 * falls back to `ambient`. One spelling for every `seed?: number | RandomSource`
 * constructor in the NAR (strategies, RL adapters, imagination, games).
 */
export declare const rngFrom: (seed: number | RandomSource | undefined, ambient?: RandomSource) => RandomSource;
/**
 * Numerical-Recipes LCG — a second algorithm, not a second PRNG *policy*. It is
 * kept because the test suites pin `Math.random` to it and changing the stream
 * would silently move every seeded expectation; it lives here rather than in a
 * test helper so a production entrypoint can use it without importing vitest.
 */
export declare const createLCG: (seed?: number) => RandomSource;
/** Random integer in [0, max). */
export declare const nextInt: (rng: RandomSource, max: number) => number;
/** Random element; throws on empty input. */
export declare const choice: <T>(rng: RandomSource, items: readonly T[]) => T;
/**
 * Stateful handle over the canonical `mulberry32` stream — the same PRNG as a
 * resettable object, for call sites that thread an RNG through constructors.
 * `getState`/`setState` checkpoint and restore the exact draw position, which is
 * what makes cloned games and RL baseline snapshots resume identically.
 */
export declare class SeededRNG implements StatefulRandomSource {
    #private;
    constructor(seed?: number);
    /** Random float in [0, 1). */
    readonly next: () => number;
    /** Adapter for utilities taking a bare `RandomSource` (e.g. `shuffleInPlace`). */
    readonly source: RandomSource;
    /** Random integer in [0, max). */
    nextInt(max: number): number;
    /** Random element; throws on empty input. */
    choice<T>(items: readonly T[]): T;
    getState(): number;
    setState(state: number): void;
}
/** In-place Fisher–Yates shuffle — the single uniform-shuffle primitive (sampling, bags, exploration). */
export declare const shuffleInPlace: <T>(items: T[], rng: RandomSource) => T[];
/** Partial Fisher–Yates shuffle — only shuffle the first `count` elements.
 *  Useful when only a small sample is needed from a large array. O(count) instead of O(n). */
export declare const partialShuffleInPlace: <T>(items: T[], count: number, rng: RandomSource) => T[];
/** Fill `out` with `[-1, 1)` draws from `seededStream` — the deterministic
 *  feature-block expansion behind per-action embeddings. A zero seed falls back
 *  to 1, matching the historical guard against a stuck all-zero stream. */
export declare const fillSeededUnitRange: (out: Float32Array, seed: number) => Float32Array;
/** Pooled version of `fillSeededUnitRange` — acquires buffer from pool. */
export declare const fillSeededUnitRangePooled: (dim: number, seed: number) => Float32Array;
/** Release a pooled buffer back to the pool. */
export declare const releaseFeatureVector: (vec: Float32Array) => void;
/**
 * Deterministic train/holdout partition — shuffles uniformly, then cuts a
 * `fraction`-sized holdout of at least one row. The single split primitive
 * behind head training, shared-head bake-off, and calibration fitting, so no
 * caller resorts to a biased `sort(() => rng() - 0.5)` shuffle.
 */
export declare const holdoutSplit: <T>(items: readonly T[], fraction: number, rng: RandomSource) => {
    holdout: T[];
    train: T[];
};
/** A candidate and the weight a draw gives it — the shape every weighted selection reads. */
export type Weighted<T> = {
    item: T;
    weight: number;
};
/**
 * Weighted sampling without replacement (roulette wheel) — the single
 * selection primitive behind priority-proportional, softmax, and windowed
 * sampling. Each draw renormalizes over the remaining pool, so the returned
 * `count` items are drawn from successively smaller populations.
 */
export declare const weightedSample: <T>(items: readonly T[], count: number, weightOf: (item: T) => number, rng: RandomSource) => T[];
/**
 * One weight-proportional item draw — the primitive behind every weighted
 * selection in the NAR (priority bags, focus scheduling, roulette sampling).
 * `undefined` means the pool has no weight to distribute, which each caller
 * already answers with its own fallback.
 */
export declare const weightedPick: <T>(items: readonly T[], weightOf: (item: T) => number, rng: RandomSource) => T | undefined;
/** Weighted sampling over pre-computed weights — the O(n) draw behind `weightedSample`. */
export declare const weightedSampleBy: <T>(entries: readonly Weighted<T>[], count: number, rng: RandomSource) => T[];
//# sourceMappingURL=random.d.ts.map