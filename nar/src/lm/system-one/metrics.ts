/**
 * Calibration metrics — the single Brier/ECE implementation, kept in a leaf
 * module so scorers (distill, train, eval) can share it without import cycles.
 */


/**
 * Identity (unfitted) calibrator ECE — the honest baseline the fit must beat.
 * Unweighted per-row MAE, matching {@link IsotonicCalibrator.getECE} at uniform
 * weight; it measures the raw score, not the calibrated curve.
 */
export function identityECE(data: readonly { predicted: number; observed: number }[]): number {
  if (data.length === 0) return 0;
  return data.reduce((sum, d) => sum + Math.abs(d.predicted - d.observed), 0) / data.length;
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
  if (rows.length === 0) return 0;
  let sum = 0;
  for (const row of rows) sum += (predicted(row) - observed(row)) ** 2;
  return sum / rows.length;
}

/** Mean squared calibration error over predicted/observed pairs. Sits beside {@link identityECE}. */
export const meanBrier = (data: readonly { predicted: number; observed: number }[]): number =>
  meanBrierOf(
    data,
    (d) => d.predicted,
    (d) => d.observed
  );
