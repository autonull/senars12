/**
 * Weight a confidence of exactly 1 would carry, which is unbounded. Revision
 * with a certain premise saturates here rather than at infinity, so the sum
 * stays finite and the round trip back lands on a confidence the domain accepts.
 */
export declare const WEIGHT_AT_CERTAINTY = 10000000000;
/** The weight a confidence `c` carries — the odds ratio, saturated at {@link WEIGHT_AT_CERTAINTY}. */
export declare const confidenceToWeight: (c: number) => number;
/** The confidence a weight `w` carries — the exact inverse of {@link confidenceToWeight}. */
export declare const weightToConfidence: (w: number) => number;
/**
 * A confidence reduced toward zero by `factor` and re-clamped — the NAL
 * weakening rule `c / (c + k)`. Ageing and weakening both land here, so the
 * curve they share is stated once rather than in each rule that uses it.
 */
export declare const weakenConfidence: (c: number, factor: number) => number;
//# sourceMappingURL=truth-algebra.d.ts.map