/**
 * Calibration metrics — the single Brier/ECE implementation, kept in a leaf
 * module so scorers (distill, train, eval) can share it without import cycles.
 */
import { mean } from '@senars/util';

/**
 * Identity (unfitted) calibrator ECE — the honest baseline the fit must beat.
 * Unweighted per-row MAE, matching {@link IsotonicCalibrator.getECE} at uniform
 * weight; it measures the raw score, not the calibrated curve.
 */
export function identityECE(data: readonly { predicted: number; observed: number }[]): number {
  if (data.length === 0) return 0;
  return mean(data, (d) => Math.abs(d.predicted - d.observed));
}

/**
 * Mean squared error between two selectors over `rows` — the single Brier
 * implementation (scores live in different shapes: dataset rows, bake-off cases,
 * training rows), so every caller ranks models by the same formula.
 */
export function meanBrierOf<T>(
  rows: readonly T[],
  predicted: (row: T) => number,
  observed: (row: T) => number
): number {
  return mean(rows, (row) => (predicted(row) - observed(row)) ** 2);
}

/** Mean squared calibration error over predicted/observed pairs. Sits beside {@link identityECE}. */
export const meanBrier = (data: readonly { predicted: number; observed: number }[]): number =>
  meanBrierOf(
    data,
    (d) => d.predicted,
    (d) => d.observed
  );

/**
 * The one frozen-set non-regression comparison, and its message. Lower Brier is
 * better, so a candidate regresses when it exceeds the baseline by more than
 * `tolerance`. Lives here — beside the Brier implementation, in the leaf module
 * — so both the throwing gate (eval-set) and the bake-off report (distill) agree.
 */
export const frozenRegression = (
  baselineBrier: number,
  candidateBrier: number,
  tolerance: number
): { regressed: boolean; reason?: string } =>
  candidateBrier > baselineBrier + tolerance
    ? {
        regressed: true,
        reason: `Frozen-set regression: candidate Brier ${candidateBrier.toFixed(4)} > baseline ${baselineBrier.toFixed(4)} + tolerance ${tolerance}`,
      }
    : { regressed: false };
