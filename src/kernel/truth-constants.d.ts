/**
 * Shared Truth Constants — single source for NAL truth algebra parameters.
 *
 * Re-exports generic truth algebra from @senars/util/truth-algebra and adds
 * kernel-specific constants. Both the engine (kernel/truth.ts) and the verifier
 * (rules/verifier-truth-table.ts) import from here to eliminate duplication.
 */
import { WEIGHT_AT_CERTAINTY, confidenceToWeight, weightToConfidence, weakenConfidence } from '@senars/util/truth-algebra';
/** Maximum confidence value (saturating bound). */
export declare const MAX_CONFIDENCE: 0.999;
/** Weakening factor for confidence decay in chains. */
export declare const WEAKENING_FACTOR = 10;
/** Gain applied when positive feedback reinforces a truth. */
export declare const CONFIRM_GAIN: 1.1;
/** Decay applied when negative feedback contradicts a truth. */
export declare const CONTRADICT_DECAY: 0.9;
/** Gain/loss applied to confidence on outcome feedback. */
export declare const OUTCOME_GAIN: 0.1;
/**
 * Weakening squash: c / (1 + c * factor).
 * Used for confidence weakening in deduction/induction/abduction chains
 * and structural deduction/reduction. Default factor = WEAKENING_FACTOR (10).
 */
export declare function weakenSquash(c: number, factor?: number): number;
/** Normalize a truth value to valid domain [0,1] x [0, MAX_CONFIDENCE]. */
export declare function normalizeTruth(f: number, c: number): {
    f: number;
    c: number;
};
export { WEIGHT_AT_CERTAINTY, confidenceToWeight, weightToConfidence, weakenConfidence, };
//# sourceMappingURL=truth-constants.d.ts.map