/**
 * Calibration metrics — the single Brier/ECE implementation, kept in a leaf
 * module so scorers (distill, train, eval) can share it without import cycles.
 */
import { mean } from '@senars/util/numeric';
import { safeRatio } from '@senars/util/numeric';
/**
 * Weighted mean absolute error, in one pass: the ECE arithmetic. {@link identityECE}
 * is this at uniform weight over raw scores, and a fitted calibrator's own
 * reading is this at its point weights over calibrated scores — two loops that
 * differ only in which number they read, which is how a fit can report that it
 * beat the baseline it was measured against without having been measured
 * against it.
 */
export function weightedAbsoluteError(rows, error, weight) {
    if (rows.length === 0)
        return 0;
    let total = 0;
    let weightSum = 0;
    for (const row of rows) {
        const w = weight(row);
        total += Math.abs(error(row)) * w;
        weightSum += w;
    }
    return safeRatio(total, weightSum);
}
/**
 * Identity (unfitted) calibrator ECE — the honest baseline the fit must beat.
 * Unweighted per-row MAE over the raw score, not the calibrated curve.
 */
export function identityECE(data) {
    return weightedAbsoluteError(data, (d) => d.predicted - d.observed, () => 1);
}
/**
 * Mean squared error between two selectors over `rows` — the single Brier
 * implementation (scores live in different shapes: dataset rows, bake-off cases,
 * training rows), so every caller ranks models by the same formula.
 */
export function meanBrierOf(rows, predicted, observed) {
    return mean(rows, (row) => (predicted(row) - observed(row)) ** 2);
}
/** Mean squared calibration error over predicted/observed pairs. Sits beside {@link identityECE}. */
export const meanBrier = (data) => meanBrierOf(data, (d) => d.predicted, (d) => d.observed);
export const frozenRegression = (baselineBrier, candidateBrier, tolerance) => candidateBrier > baselineBrier + tolerance
    ? {
        regressed: true,
        reason: `Frozen-set regression: candidate Brier ${candidateBrier.toFixed(4)} > baseline ${baselineBrier.toFixed(4)} + tolerance ${tolerance}`,
    }
    : { regressed: false };
