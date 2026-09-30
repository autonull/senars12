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

export const softmax = (values: readonly number[]): number[] => {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const total = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / total);
};

export const safeDiv = (num: number, den: number): number =>
  den === 0 ? 0 : clamp(num / den, 0, 1);

/** Arithmetic mean of a projection; 0 for an empty collection (rates, scores, sums). */
export const mean = <T>(
  items: readonly T[],
  value: (item: T) => number = (item) => item as unknown as number
): number =>
  items.length === 0 ? 0 : items.reduce((sum, item) => sum + value(item), 0) / items.length;

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
