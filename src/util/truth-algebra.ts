import { clamp, clamp01, softSquash } from './numeric.js';

/**
 * Weight a confidence of exactly 1 would carry, which is unbounded. Revision
 * with a certain premise saturates here rather than at infinity, so the sum
 * stays finite and the round trip back lands on a confidence the domain accepts.
 */
export const WEIGHT_AT_CERTAINTY = 1e10;

/** The weight a confidence `c` carries — the odds ratio, saturated at {@link WEIGHT_AT_CERTAINTY}. */
export const confidenceToWeight = (c: number): number =>
  c === 1 ? WEIGHT_AT_CERTAINTY : c / (1 - c);

/** The confidence a weight `w` carries — the exact inverse of {@link confidenceToWeight}. */
export const weightToConfidence = (w: number): number => softSquash(w);

/**
 * A confidence reduced toward zero by `factor` and re-clamped — the NAL
 * weakening rule `c / (c + k)`. Ageing and weakening both land here, so the
 * curve they share is stated once rather than in each rule that uses it.
 */
export const weakenConfidence = (c: number, factor: number): number =>
  clamp(softSquash(c, factor), 0, 1);