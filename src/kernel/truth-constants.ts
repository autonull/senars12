/**
 * Shared Truth Constants — single source for NAL truth algebra parameters.
 *
 * Both the engine (kernel/truth.ts) and the verifier (rules/verifier-truth-table.ts)
 * import from here to eliminate constant duplication while keeping implementations
 * independent for drift detection.
 */

import { clamp } from '@senars/util/numeric';

/** Maximum confidence value (saturating bound). */
export const MAX_CONFIDENCE = 0.999 as const;

/** Weakening factor for confidence decay in chains. */
export const WEAKENING_FACTOR = 10;

/** Gain applied when positive feedback reinforces a truth. */
export const CONFIRM_GAIN = 1.1 as const;

/** Decay applied when negative feedback contradicts a truth. */
export const CONTRADICT_DECAY = 0.9 as const;

/** Gain/loss applied to confidence on outcome feedback. */
export const OUTCOME_GAIN = 0.1 as const;

/** Weight at certainty (c = 1) — saturated to a large finite value for numerical stability. */
export const WEIGHT_AT_CERTAINTY = 1e10 as const;

/**
 * Soft squash function for weight-to-confidence conversion: x / (x + 1).
 * This is the exact inverse of confidenceToWeight: c / (1 - c).
 * Used for weightToConfidence.
 */
export function weightToConfidence(w: number): number {
  if (!Number.isFinite(w)) return 1;
  return w / (w + 1);
}

/**
 * Convert confidence to weight (odds ratio).
 * Weight saturates at WEIGHT_AT_CERTAINTY for c >= 1.
 */
export function confidenceToWeight(c: number): number {
  if (c >= 1) return WEIGHT_AT_CERTAINTY;
  return c / (1 - c);
}

/**
 * Weakening squash: c / (1 + c * factor).
 * Used for confidence weakening in deduction/induction/abduction chains
 * and structural deduction/reduction. Default factor = WEAKENING_FACTOR (10).
 */
export function weakenSquash(c: number, factor = WEAKENING_FACTOR): number {
  return c / (1 + c * factor);
}

/**
 * A confidence reduced toward zero by `factor` and re-clamped — the NAL
 * weakening rule `c / (c + k)`. Ageing and weakening both land here, so the
 * curve they share is stated once rather than in each rule that uses it.
 */
export function weakenConfidence(c: number, factor: number): number {
  const weakened = weakenSquash(c, factor);
  return clamp(weakened, 0, 1 as number);
}

/** Normalize a truth value to valid domain [0,1] x [0, MAX_CONFIDENCE]. */
export function normalizeTruth(f: number, c: number): { f: number; c: number } {
  return {
    f: clamp(isNaN(f) ? 0.5 : f, 0, 1),
    c: clamp(isNaN(c) ? 0.9 : c, 0, MAX_CONFIDENCE),
  };
}