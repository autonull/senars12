/**
 * Weighted mean absolute error, in one pass: the ECE arithmetic. {@link identityECE}
 * is this at uniform weight over raw scores, and a fitted calibrator's own
 * reading is this at its point weights over calibrated scores — two loops that
 * differ only in which number they read, which is how a fit can report that it
 * beat the baseline it was measured against without having been measured
 * against it.
 */
export declare function weightedAbsoluteError<T>(rows: readonly T[], error: (row: T) => number, weight: (row: T) => number): number;
/**
 * Identity (unfitted) calibrator ECE — the honest baseline the fit must beat.
 * Unweighted per-row MAE over the raw score, not the calibrated curve.
 */
export declare function identityECE(data: readonly {
    predicted: number;
    observed: number;
}[]): number;
/**
 * Mean squared error between two selectors over `rows` — the single Brier
 * implementation (scores live in different shapes: dataset rows, bake-off cases,
 * training rows), so every caller ranks models by the same formula.
 */
export declare function meanBrierOf<T>(rows: readonly T[], predicted: (row: T) => number, observed: (row: T) => number): number;
/** Mean squared calibration error over predicted/observed pairs. Sits beside {@link identityECE}. */
export declare const meanBrier: (data: readonly {
    predicted: number;
    observed: number;
}[]) => number;
/**
 * The one frozen-set non-regression comparison, and its message. Lower Brier is
 * better, so a candidate regresses when it exceeds the baseline by more than
 * `tolerance`. Lives here — beside the Brier implementation, in the leaf module
 * — so both the throwing gate (eval-set) and the bake-off report (distill) agree.
 */
export type RegressionVerdict = {
    regressed: false;
} | {
    regressed: true;
    reason: string;
};
export declare const frozenRegression: (baselineBrier: number, candidateBrier: number, tolerance: number) => RegressionVerdict;
//# sourceMappingURL=metrics.d.ts.map