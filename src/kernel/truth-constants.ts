/**
 * Shared Truth Constants — single source for NAL truth algebra parameters.
 *
 * Both the engine (kernel/truth.ts) and the verifier (rules/verifier-truth-table.ts)
 * import from here to eliminate constant duplication while keeping implementations
 * independent for drift detection.
 */

/** Maximum confidence value (saturating bound). */
export const MAX_CONFIDENCE = 0.999 as const;

/** Weakening factor for confidence decay in chains. */
export const WEAKENING_FACTOR = 10 as const;

/** Gain applied when positive feedback reinforces a truth. */
export const CONFIRM_GAIN = 1.1 as const;

/** Decay applied when negative feedback contradicts a truth. */
export const CONTRADICT_DECAY = 0.9 as const;

/** Gain/loss applied to confidence on outcome feedback. */
export const OUTCOME_GAIN = 0.1 as const;

/**
 * Soft squash function: c / (1 + c * factor).
 * Used for confidence weakening in deduction/induction/abduction chains.
 */
export function softSquash(c: number, factor = WEAKENING_FACTOR): number {
  return c / (1 + c * factor);
}

/**
 * Convert confidence to weight (odds ratio).
 * Weight saturates at WEIGHT_AT_CERTAINTY for c >= 1.
 */
export function confidenceToWeight(c: number): number {
  if (c >= 1) return Number.MAX_VALUE;
  return c / (1 - c);
}

/**
 * Convert weight to confidence (inverse of confidenceToWeight).
 */
export function weightToConfidence(w: number): number {
  if (!Number.isFinite(w) || w >= Number.MAX_VALUE) return 1;
  return w / (1 + w);
}

/** Normalize a truth value to valid domain [0,1] x [0, MAX_CONFIDENCE]. */
export function normalizeTruth(f: number, c: number): { f: number; c: number } {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  return {
    f: clamp(isNaN(f) ? 0.5 : f, 0, 1),
    c: clamp(isNaN(c) ? 0.9 : c, 0, MAX_CONFIDENCE),
  };
}