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
import { shareCount } from './collections';
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
export const ambientRng = () => Math.random();
/** Whether `value` is a stateful source whose draw position can be checkpointed. */
export const isStatefulRandomSource = (value) => typeof value === 'object' &&
    value !== null &&
    typeof value.source === 'function' &&
    typeof value.getState === 'function' &&
    typeof value.setState === 'function';
/** A stateful source reduced to its bare draw function; a plain source passes through. */
export const randomSourceOf = (value) => (isStatefulRandomSource(value) ? value.source : value);
/**
 * mulberry32 as a resumable stream. The state word is the only thing separating
 * position N from position N+k, so exposing it is what makes a mid-run
 * checkpoint (`SeededRNG.getState`) restore an exact continuation rather than
 * restarting the sequence from its seed.
 */
export const seededStream = (seed) => {
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
export const mulberry32 = (seed) => seededStream(seed).next;
/**
 * A seed-or-source parameter resolved to a draw function: a bare function
 * passes through, a number pins a fresh mulberry32 stream, and `undefined`
 * falls back to `ambient`. One spelling for every `seed?: number | RandomSource`
 * constructor in the NAR (strategies, RL adapters, imagination, games).
 */
export const rngFrom = (seed, ambient = Math.random) => seed === undefined ? ambient : typeof seed === 'function' ? seed : mulberry32(seed);
/**
 * Numerical-Recipes LCG — a second algorithm, not a second PRNG *policy*. It is
 * kept because the test suites pin `Math.random` to it and changing the stream
 * would silently move every seeded expectation; it lives here rather than in a
 * test helper so a production entrypoint can use it without importing vitest.
 */
export const createLCG = (seed = 0x2f6e2b1) => {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
};
/** Random integer in [0, max). */
export const nextInt = (rng, max) => Math.floor(rng() * max);
/** Random element; throws on empty input. */
export const choice = (rng, items) => {
    const picked = items[nextInt(rng, items.length)];
    if (picked === undefined)
        throw new RangeError('choice from empty array');
    return picked;
};
/**
 * Stateful handle over the canonical `mulberry32` stream — the same PRNG as a
 * resettable object, for call sites that thread an RNG through constructors.
 * `getState`/`setState` checkpoint and restore the exact draw position, which is
 * what makes cloned games and RL baseline snapshots resume identically.
 */
export class SeededRNG {
    #stream;
    constructor(seed = 1) {
        this.#stream = seededStream(seed);
    }
    /** Random float in [0, 1). */
    next = () => this.#stream.next();
    /** Adapter for utilities taking a bare `RandomSource` (e.g. `shuffleInPlace`). */
    source = () => this.#stream.next();
    /** Random integer in [0, max). */
    nextInt(max) {
        return nextInt(this.#stream.next, max);
    }
    /** Random element; throws on empty input. */
    choice(items) {
        return choice(this.#stream.next, items);
    }
    getState() {
        return this.#stream.state();
    }
    setState(state) {
        this.#stream = seededStream(state);
    }
}
/** In-place Fisher–Yates shuffle — the single uniform-shuffle primitive (sampling, bags, exploration). */
export const shuffleInPlace = (items, rng) => {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
};
/** Partial Fisher–Yates shuffle — only shuffle the first `count` elements.
 *  Useful when only a small sample is needed from a large array. O(count) instead of O(n). */
export const partialShuffleInPlace = (items, count, rng) => {
    const n = items.length;
    const effectiveCount = Math.min(count, n);
    for (let i = n - 1; i >= n - effectiveCount; i--) {
        const j = Math.floor(rng() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
};
/** Per-dimension buffer pool for deterministic feature vectors. */
const featurePools = new Map();
/** Acquire a buffer from the pool or allocate a new one. */
function acquireFeatureBuffer(dim) {
    const pool = featurePools.get(dim) ?? [];
    if (pool.length > 0)
        return pool.pop();
    return new Float32Array(dim);
}
/** Release a buffer back to the pool. */
function releaseFeatureBuffer(dim, buffer) {
    const pool = featurePools.get(dim) ?? [];
    pool.push(buffer);
    featurePools.set(dim, pool);
}
/** Fill `out` with `[-1, 1)` draws from `seededStream` — the deterministic
 *  feature-block expansion behind per-action embeddings. A zero seed falls back
 *  to 1, matching the historical guard against a stuck all-zero stream. */
export const fillSeededUnitRange = (out, seed) => {
    const next = seededStream(seed || 1).next;
    for (let i = 0; i < out.length; i++)
        out[i] = next() * 2 - 1;
    return out;
};
/** Pooled version of `fillSeededUnitRange` — acquires buffer from pool. */
export const fillSeededUnitRangePooled = (dim, seed) => {
    const out = acquireFeatureBuffer(dim);
    return fillSeededUnitRange(out, seed);
};
/** Release a pooled buffer back to the pool. */
export const releaseFeatureVector = (vec) => {
    releaseFeatureBuffer(vec.length, vec);
};
/**
 * Deterministic train/holdout partition — shuffles uniformly, then cuts a
 * `fraction`-sized holdout of at least one row. The single split primitive
 * behind head training, shared-head bake-off, and calibration fitting, so no
 * caller resorts to a biased `sort(() => rng() - 0.5)` shuffle.
 */
export const holdoutSplit = (items, fraction, rng) => {
    const shuffled = shuffleInPlace([...items], rng);
    const cut = Math.min(shuffled.length, shareCount(shuffled.length, fraction));
    return { holdout: shuffled.slice(0, cut), train: shuffled.slice(cut) };
};
/**
 * Weighted sampling without replacement (roulette wheel) — the single
 * selection primitive behind priority-proportional, softmax, and windowed
 * sampling. Each draw renormalizes over the remaining pool, so the returned
 * `count` items are drawn from successively smaller populations.
 */
export const weightedSample = (items, count, weightOf, rng) => weightedSampleBy(items.map((item) => ({ item, weight: weightOf(item) })), count, rng);
/**
 * The index of a weight-proportional draw over `count` slots, or -1 when the
 * pool is empty or carries no weight. The one weighted scan in the NAR: the
 * total is read off the pool itself rather than a cached scalar, so a stale
 * aggregate cannot skew the draw. Non-positive weights are never drawn.
 */
const weightedScan = (count, weightAt, rng) => {
    let total = 0;
    for (let i = 0; i < count; i++) {
        const weight = weightAt(i);
        if (weight > 0)
            total += weight;
    }
    if (total <= 0)
        return -1;
    let roll = rng() * total;
    for (let i = 0; i < count; i++) {
        const weight = weightAt(i);
        if (weight <= 0)
            continue;
        roll -= weight;
        if (roll <= 0)
            return i;
    }
    return count - 1;
};
/**
 * One weight-proportional item draw — the primitive behind every weighted
 * selection in the NAR (priority bags, focus scheduling, roulette sampling).
 * `undefined` means the pool has no weight to distribute, which each caller
 * already answers with its own fallback.
 */
export const weightedPick = (items, weightOf, rng) => {
    const index = weightedScan(items.length, (i) => weightOf(items[i]), rng);
    return index < 0 ? undefined : items[index];
};
/** Weighted sampling over pre-computed weights — the O(n) draw behind `weightedSample`. */
export const weightedSampleBy = (entries, count, rng) => {
    const n = entries.length;
    if (n === 0 || count === 0)
        return [];
    // Find valid (weight > 0) entries and their indices
    const validIndices = [];
    let totalWeight = 0;
    for (let i = 0; i < n; i++) {
        const w = entries[i].weight;
        if (w > 0) {
            validIndices.push(i);
            totalWeight += w;
        }
    }
    // All-zero weights carry no information — fall back to source order.
    if (validIndices.length === 0) {
        return entries.slice(0, count).map((entry) => entry.item);
    }
    // Use reservoir sampling approach: pick indices without replacement
    // by swapping picked elements to the end of validIndices
    const picked = [];
    let remaining = validIndices.length;
    for (let draw = 0; draw < count && remaining > 0; draw++) {
        // Compute prefix sums for weighted selection over remaining valid items
        let roll = rng() * totalWeight;
        let selectedPos = 0;
        for (let i = 0; i < remaining; i++) {
            const idx = validIndices[i];
            const w = entries[idx].weight;
            roll -= w;
            if (roll <= 0) {
                selectedPos = i;
                break;
            }
        }
        const selectedIdx = validIndices[selectedPos];
        picked.push(entries[selectedIdx].item);
        totalWeight -= entries[selectedIdx].weight;
        // Swap selected with last remaining and shrink
        validIndices[selectedPos] = validIndices[remaining - 1];
        remaining--;
    }
    return picked;
};
