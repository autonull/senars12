/**
 * The scalar arithmetic every bounded container, scorer, and bandit policy
 * shares. Each of these is a place two subsystems used to disagree by a percent.
 */
/** Characters per token in {@link estimateTokens} — its inverse, for budgeting characters from a token allowance. */
export declare const CHARS_PER_TOKEN = 4;
/** Rough token count: ~4 characters per token. Single source for every budget. */
export declare const estimateTokens: (text: string) => number;
export declare const clamp: (v: number, min: number, max: number) => number;
export declare const clamp01: (v: number) => number;
/**
 * Clamp to `[-bound, bound]` — the bound a reward, a score or a policy signal
 * carries. Signed, unlike {@link clamp01}: a negative reward is information, and
 * a clamp that floored it at zero would report every loss as neutrality.
 */
export declare const clampSigned: (v: number, bound?: number) => number;
/**
 * Finite number from a value of unknown provenance, or `undefined` when it is not
 * one — the coercion behind env parsing, CLI flags, restored records, and labels
 * that may be categorical.
 *
 * Only `number` and `string` are considered. `Number()` alone accepts far more
 * (`Number(null)` and `Number([])` are both `0`, `Number(true)` is `1`), so an
 * absent value and a zero were indistinguishable, and a missing setting read as
 * a real one. A blank string is absent for the same reason `envFirst` treats it
 * as absent: the key was set, not the value.
 *
 * `NaN` and `±Infinity` are rejected, which is the whole point — they survive
 * arithmetic silently and surface as a `null` in a Zod schema three layers later.
 */
export declare const toFiniteNumber: (value: unknown) => number | undefined;
/** {@link toFiniteNumber} with the fallback applied, for call sites that must yield a number. */
export declare const finiteOr: (value: unknown, fallback: number) => number;
/**
 * Occupancy of a bounded resource in `0..1` — the AIKR pressure signal every
 * bounded container reports, so "how full is this" is answered the same way by
 * the bag, the link layer, and the pending-request queue.
 *
 * A non-positive `capacity` is an *unbounded* container. `unboundedOccupancy`
 * says what an unbounded container reports, and it is not one answer: a
 * container that has no admission check can never shed load, so it is fully
 * occupied (the default), whereas an unlimited *budget* dimension has nothing
 * to exhaust and is therefore unpressured (`0`).
 */
export declare const occupancy: (used: number, capacity: number, unboundedOccupancy?: number) => number;
/** Round to `digits` decimal places — the one float-noise guard for reported values. */
export declare const roundTo: (v: number, digits?: number) => number;
/** Logistic function; the single sigmoid used by scoring and gradient descent. */
export declare const sigmoid: (z: number) => number;
/**
 * Move `fraction` of the way from `from` toward `to`.
 *
 * The step form and the convex-combination form are the same algebra written
 * twice, and which one a line uses says nothing about the policy: an RL update
 * and a Q-belief write are both "trust the new sample this much".
 */
export declare const lerp: (from: number, to: number, fraction: number) => number;
/**
 * `1 - exp(-x / scale)` — how much of a thing `x` has been seen, saturating at 1.
 * Visit-count confidence and drive intensity are the same curve over different
 * units; {@link decayCurve} is its inverse.
 */
export declare const saturationRamp: (x: number, scale: number) => number;
/**
 * `initial · exp(-rate · elapsed)` — how much of a confidence survives `elapsed`
 * units of time. The inverse of {@link saturationRamp}: where that answers "how
 * much have I seen", this answers "how much do I still hold".
 */
export declare const decayCurve: (initial: number, rate: number, elapsed: number) => number;
/**
 * `value · (1 − rate)` — what survives one forgetting step. The retention
 * algebra: every container that ages a weight out of existence composes this
 * same factor, so a rate means the same thing in the bag, the link layer, the
 * concept graph and a drive.
 *
 * Related but distinct from {@link decayCurve}, which answers "how much of a
 * confidence survives `elapsed` units of time" and is the only exponential
 * form in the tree. Composing `retain` `n` times is the discrete equivalent.
 */
export declare const retain: (value: number, rate: number) => number;
/**
 * A rate annealing toward a floor: `clamp(value · survival, floor, ceiling)` —
 * the shape of every exploration schedule that decays and then refuses to decay
 * further. The counterpart of {@link retain}: a schedule is configured by what
 * fraction *survives* each episode, while a forgetting step is configured by
 * what fraction is *lost*, and the two schedules each spelled the multiply and
 * the floor out themselves.
 */
export declare const anneal: (value: number, survival: number, floor?: number, ceiling?: number) => number;
/**
 * `value · rate` — the amount one forgetting step removes. The deduction
 * algebra, the exact complement of {@link retain}: a model that reports what
 * it subtracts must not also scale by the survivor.
 */
export declare const forget: (value: number, rate: number) => number;
/**
 * `num / den`, with the empty-denominator answer supplied rather than implied.
 *
 * Every rate in the system is "something over how much of it there was" — a hit
 * rate, an agreement rate, a mean loss — and a zero denominator is a real state
 * (no seeds, no writes yet, no preferences), not an error. What that state
 * *means* differs by question, so `empty` is a parameter: `0` for a rate with no
 * observations, `null` for "not measurable" where a number would be a lie.
 *
 * Expressed as {@link safeRatio} rather than left as eight open-coded
 * `total > 0 ? x / total : 0` ternaries, which is how the denominator guards came
 * to disagree three ways — some answered `0`, some returned the un-normalized
 * input, one answered `null`.
 */
export declare const safeRatio: (num: number, den: number, empty?: number) => number;
/**
 * `num / max(floor, den)` — the ratio whose denominator is a *population*, not a
 * guard.
 *
 * Distinct from {@link safeRatio} on purpose, because the two disagree and both
 * are right. A rate over a population it cannot exceed — a share of slots used,
 * a fraction of options carrying mass — divides by how many there could have
 * been, and answers `0` when there are none. {@link safeRatio} instead treats a
 * non-positive denominator as "unmeasurable" and hands back `empty`. Folding
 * the floor into `safeRatio` would silently turn every unmeasurable rate into
 * zero; folding these into open-coded `Math.max(1, den)` leaves the shared
 * vocabulary with a hole in it that each new rate re-invents.
 */
export declare const flooredRatio: (num: number, den: number, floor?: number) => number;
/** `count` per second over `elapsedMs` — the one rate a benchmark reports. */
export declare const perSecond: (count: number, elapsedMs: number, empty?: number) => number;
/** Sum of a projection — the numerator half of every {@link safeRatio}. */
export declare const sumBy: <T>(items: Iterable<T>, value?: (item: T) => number) => number;
/**
 * Arithmetic mean over a projection — {@link safeRatio} with the count as
 * denominator, counted in the same pass rather than read off `items.length`, so
 * a container's own values (`map.values()`, a ring's items) can be averaged
 * without being materialized into an array first.
 */
export declare const meanOf: <T>(items: Iterable<T>, value: (item: T) => number, empty?: number) => number;
export declare const safeDiv: (num: number, den: number) => number;
/**
 * Rescale values so they sum to 1. `empty` is returned when they cannot — the
 * non-positive total is what a caller must decide about, because "no weight
 * anywhere" means either "leave the input alone" or "distribute nothing", and
 * those are different answers to different questions.
 */
export declare const normalizeToSum: <T>(items: readonly T[], value: (item: T) => number, empty?: readonly number[]) => readonly number[];
/**
 * Rescale each item *in place of its mass* so the masses sum to 1, keeping the
 * items. {@link normalizeToSum} is this with the item thrown away; where the
 * payload rides along with the number — a score and the option it is for — the
 * throwaway form is not usable and the guard would otherwise be re-written.
 * `fallback` is returned when the masses cannot be normalized, and defaults to
 * the input: an un-normalizable set is already whatever the caller had.
 */
export declare const renormalize: <T, R = T>(items: readonly T[], mass: (item: T) => number, rescale: (item: T, share: number) => R, fallback?: readonly R[]) => readonly R[];
/**
 * `x / (x + k)` — the reciprocal saturation curve, for a quantity with a natural
 * ceiling that has no natural top (a visit count, an uncertainty, a completion
 * length).
 *
 * Unrelated to {@link saturationRamp}: that answers "how much have I seen" and
 * saturates on elapsed time, this answers "how much of a magnitude is this" and
 * is unchanged by scaling `x` up. It is the form the whole truth mapping uses —
 * every confidence→weight and weight→confidence step, every `c / (c + k)`
 * weakening — so those steps have one definition rather than one per call site,
 * and a change to the curve cannot land in a third of them.
 */
export declare const softSquash: (x: number, k?: number) => number;
/**
 * `1 / (1 + x)` — the decay-from-one curve, for a quantity that is strongest at
 * zero distance and vanishes asymptotically instead of settling on a floor: a
 * stability read off a dispersion, a recency read off an age, a conciseness read
 * off a log length.
 *
 * The mirror of {@link softSquash}, not a variant of it: that answers "how much
 * of a magnitude is this" for a quantity with a natural ceiling, this answers
 * "how close is this to now". Both were open-coded as `1 / (1 + …)` at every site
 * that wanted one, so the shape of a decay was re-derived per call and no single
 * edit could tune all of them. `x` must exceed `-1`; `clamp01` it first if it can.
 */
export declare const softFalloff: (x: number) => number;
/**
 * Float equality within `eps`. The one guard for "these two accumulated truth
 * values are the same number", where `===` fails on accumulated rounding.
 */
export declare const nearlyEqual: (a: number, b: number, eps?: number) => boolean;
/** The max is a loop, not `Math.max(...values)`: the spread is a call-arity limit. */
export declare const softmax: (values: readonly number[]) => number[];
/**
 * Convert items with scores to weighted items using softmax.
 * Useful for temperature-controlled sampling strategies.
 */
export declare const softmaxWeights: <T>(items: readonly T[], scoreOf: (item: T) => number) => Array<{
    item: T;
    weight: number;
}>;
/**
 * Inverse temperature: `1 / T`, floored so a zero temperature degrades to greedy
 * rather than dividing by zero.
 */
export declare const invTemperature: (temperature: number) => number;
/** Arithmetic mean of a projection; 0 for an empty collection (rates, scores, sums). */
export declare const mean: <T>(items: Iterable<T>, value?: (item: T) => number) => number;
/** Population variance of a projection; 0 for fewer than two samples. */
export declare const variance: <T>(items: readonly T[], value?: (item: T) => number) => number;
/** Population standard deviation — `sqrt(variance)`. */
export declare const stdDev: typeof variance;
/**
 * Pearson correlation over the leading `min(xs, ys)` samples. The single
 * correlation implementation behind head training and RL parity scoring.
 */
export declare const pearson: (xs: readonly number[], ys: readonly number[]) => number;
/**
 * UCB1 exploration term: `c · sqrt(ln(total) / visits)`, with untried arms
 * scored as the maximum. The single bandit formula behind every UCB policy —
 * the reflex and the manifold RL agent must not drift apart.
 */
export declare const ucb1: (value: number, visits: number, totalVisits: number, c: number) => number;
//# sourceMappingURL=numeric.d.ts.map