/**
 * The scalar arithmetic every bounded container, scorer, and bandit policy
 * shares. Each of these is a place two subsystems used to disagree by a percent.
 */

/** Characters per token in {@link estimateTokens} — its inverse, for budgeting characters from a token allowance. */
export const CHARS_PER_TOKEN = 4;

/** Rough token count: ~4 characters per token. Single source for every budget. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / CHARS_PER_TOKEN);

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * Clamp to `[-bound, bound]` — the bound a reward, a score or a policy signal
 * carries. Signed, unlike {@link clamp01}: a negative reward is information, and
 * a clamp that floored it at zero would report every loss as neutrality.
 */
export const clampSigned = (v: number, bound = 1): number => clamp(v, -bound, bound);

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
export const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** {@link toFiniteNumber} with the fallback applied, for call sites that must yield a number. */
export const finiteOr = (value: unknown, fallback: number): number =>
  toFiniteNumber(value) ?? fallback;

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
export const occupancy = (used: number, capacity: number, unboundedOccupancy = 1): number =>
  capacity > 0 ? clamp01(used / capacity) : unboundedOccupancy;

/** Round to `digits` decimal places — the one float-noise guard for reported values. */
export const roundTo = (v: number, digits = 2): number => {
  const scale = 10 ** digits;
  return Math.round(v * scale) / scale;
};

/** Logistic function; the single sigmoid used by scoring and gradient descent. */
export const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

/**
 * Move `fraction` of the way from `from` toward `to`.
 *
 * The step form and the convex-combination form are the same algebra written
 * twice, and which one a line uses says nothing about the policy: an RL update
 * and a Q-belief write are both "trust the new sample this much".
 */
export const lerp = (from: number, to: number, fraction: number): number =>
  from + (to - from) * fraction;

/**
 * `1 - exp(-x / scale)` — how much of a thing `x` has been seen, saturating at 1.
 * Visit-count confidence and drive intensity are the same curve over different
 * units; {@link decayCurve} is its inverse.
 */
export const saturationRamp = (x: number, scale: number): number =>
  scale > 0 ? 1 - Math.exp(-x / scale) : x > 0 ? 1 : 0;

/**
 * `initial · exp(-rate · elapsed)` — how much of a confidence survives `elapsed`
 * units of time. The inverse of {@link saturationRamp}: where that answers "how
 * much have I seen", this answers "how much do I still hold".
 */
export const decayCurve = (initial: number, rate: number, elapsed: number): number =>
  initial * Math.exp(-rate * elapsed);

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
export const safeRatio = (num: number, den: number, empty: number = 0): number =>
  den > 0 ? num / den : empty;

/** Sum of a projection — the numerator half of every {@link safeRatio}. */
export const sumBy = <T>(
  items: Iterable<T>,
  value: (item: T) => number = (item) => item as unknown as number
): number => {
  let total = 0;
  for (const item of items) total += value(item);
  return total;
};

/** Arithmetic mean over a projection — {@link safeRatio} with the count as denominator. */
export const meanOf = <T>(
  items: readonly T[],
  value: (item: T) => number,
  empty: number = 0
): number => safeRatio(sumBy(items, value), items.length, empty);

export const safeDiv = (num: number, den: number): number => clamp01(safeRatio(num, den));

/**
 * Rescale values so they sum to 1. `empty` is returned when they cannot — the
 * non-positive total is what a caller must decide about, because "no weight
 * anywhere" means either "leave the input alone" or "distribute nothing", and
 * those are different answers to different questions.
 */
export const normalizeToSum = <T>(
  items: readonly T[],
  value: (item: T) => number,
  empty: readonly number[] = []
): readonly number[] => {
  const total = sumBy(items, value);
  return total > 0 ? items.map((item) => value(item) / total) : empty;
};

/**
 * Float equality within `eps`. The one guard for "these two accumulated truth
 * values are the same number", where `===` fails on accumulated rounding.
 */
export const nearlyEqual = (a: number, b: number, eps = Number.EPSILON * 8): boolean =>
  Math.abs(a - b) <= eps;

export const softmax = (values: readonly number[]): number[] => {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  return exps.map((e) => safeRatio(e, sumBy(exps)));
};

/** Arithmetic mean of a projection; 0 for an empty collection (rates, scores, sums). */
export const mean = <T>(
  items: readonly T[],
  value: (item: T) => number = (item) => item as unknown as number
): number => meanOf(items, value);

/** Population variance of a projection; 0 for fewer than two samples. */
export const variance = <T>(
  items: readonly T[],
  value: (item: T) => number = (item) => item as unknown as number
): number => {
  if (items.length < 2) return 0;
  const avg = mean(items, value);
  return mean(items, (item) => (value(item) - avg) ** 2);
};

/** Population standard deviation — `sqrt(variance)`. */
export const stdDev: typeof variance = (items, value) => Math.sqrt(variance(items, value));

/**
 * Pearson correlation over the leading `min(xs, ys)` samples. The single
 * correlation implementation behind head training and RL parity scoring.
 */
export const pearson = (xs: readonly number[], ys: readonly number[]): number => {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] ?? 0) - mx;
    const dy = (ys[i] ?? 0) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
};

/**
 * UCB1 exploration term: `c · sqrt(ln(total) / visits)`, with untried arms
 * scored as the maximum. The single bandit formula behind every UCB policy —
 * the reflex and the manifold RL agent must not drift apart.
 */
export const ucb1 = (value: number, visits: number, totalVisits: number, c: number): number => {
  if (visits <= 0) return Number.POSITIVE_INFINITY;
  return value + c * Math.sqrt(Math.log(Math.max(1, totalVisits)) / visits);
};
