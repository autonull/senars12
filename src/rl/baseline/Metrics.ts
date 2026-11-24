/**
 * RL Baseline Metrics — standard evaluation metrics for RL algorithms.
 *
 * Provides win rate, Brier score, regret, calibration, and other
 * standard RL evaluation metrics.
 */

import type { BaselineArmConfig } from '../baselines';

/** Configuration for metric computation. */
export interface MetricsConfig {
  /** Confidence level for confidence intervals (e.g., 0.95). */
  confidenceLevel?: number;
  /** Window size for rolling metrics. */
  windowSize?: number;
}

/** Result of a single evaluation episode. */
export interface EpisodeResult {
  /** Arm configuration that was evaluated. */
  armConfig: BaselineArmConfig;
  /** Reward received in this episode. */
  reward: number;
  /** Whether the episode was a "win" (reward > 0). */
  win: boolean;
  /** Steps taken in this episode. */
  steps: number;
  /** Additional metrics. */
  metrics?: Record<string, number>;
}

/** Aggregated metrics for an arm. */
export interface ArmMetrics {
  /** Arm configuration. */
  armConfig: BaselineArmConfig;
  /** Total number of episodes. */
  totalEpisodes: number;
  /** Total reward accumulated. */
  totalReward: number;
  /** Average reward per episode. */
  avgReward: number;
  /** Win rate (episodes with reward > 0). */
  winRate: number;
  /** Standard deviation of rewards. */
  rewardStdDev: number;
  /** Brier score for reward prediction. */
  brierScore: number;
  /** Regret (cumulative difference from optimal). */
  regret: number;
  /** Calibration error (reliability of predicted vs actual rewards). */
  calibrationError: number;
  /** Confidence interval for average reward [lower, upper]. */
  rewardCI: [number, number];
  /** Confidence interval for win rate [lower, upper]. */
  winRateCI: [number, number];
}

/** Comparison result between two arms. */
export interface ArmComparison {
  /** First arm metrics. */
  armA: ArmMetrics;
  /** Second arm metrics. */
  armB: ArmMetrics;
  /** Statistical significance (p-value) of difference in avg reward. */
  pValue: number;
  /** Whether the difference is statistically significant at alpha=0.05. */
  significant: boolean;
  /** Effect size (Cohen's d). */
  effectSize: number;
  /** Which arm is better (if significant). */
  betterArm: 'A' | 'B' | 'tie';
}

/** Compute mean of an array. */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Compute standard deviation of an array. */
function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Compute confidence interval for mean (using t-distribution approximation). */
function meanCI(values: number[], confidence = 0.95): [number, number] {
  if (values.length <= 1) return [0, 0];
  const m = mean(values);
  const se = stdDev(values) / Math.sqrt(values.length);
  // Approximate t-critical value for 95% CI
  const tCrit = confidence >= 0.95 ? 1.96 : 1.645;
  return [m - tCrit * se, m + tCrit * se];
}

/** Compute confidence interval for proportion (Wilson score interval). */
function proportionCI(wins: number, total: number, confidence = 0.95): [number, number] {
  if (total === 0) return [0, 0];
  const p = wins / total;
  const z = confidence >= 0.95 ? 1.96 : 1.645;
  const denominator = 1 + z * z / total;
  const centre = (p + z * z / (2 * total)) / denominator;
  const halfWidth = (z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total))) / denominator;
  return [centre - halfWidth, centre + halfWidth];
}

/** Compute Brier score for binary outcomes. */
export function brierScore(predictions: number[], outcomes: number[]): number {
  if (predictions.length !== outcomes.length || predictions.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i] ?? 0;
    const out = outcomes[i] ?? 0;
    const diff = pred - out;
    sum += diff * diff;
  }
  return sum / predictions.length;
}

/** Compute cumulative regret. */
export function cumulativeRegret(rewards: number[], optimalReward: number): number {
  let regret = 0;
  for (const r of rewards) {
    regret += optimalReward - r;
  }
  return regret;
}

/** Compute calibration error (reliability diagram based). */
export function calibrationError(predictions: number[], outcomes: number[], bins = 10): number {
  if (predictions.length !== outcomes.length || predictions.length === 0) return 0;
  const binSize = 1 / bins;
  let totalError = 0;
  let totalCount = 0;

  for (let b = 0; b < bins; b++) {
    const lower = b * binSize;
    const upper = (b + 1) * binSize;
    const binIndices = predictions
      .map((p, i) => (p >= lower && p < upper) ? i : -1)
      .filter(i => i >= 0);

    if (binIndices.length === 0) continue;

    const avgPrediction = mean(binIndices.map(i => predictions[i] ?? 0));
    const avgOutcome = mean(binIndices.map(i => outcomes[i] ?? 0));
    totalError += Math.abs(avgPrediction - avgOutcome) * binIndices.length;
    totalCount += binIndices.length;
  }

  return totalCount > 0 ? totalError / totalCount : 0;
}

/** Compute win rate. */
export function winRate(rewards: number[]): number {
  if (rewards.length === 0) return 0;
  const wins = rewards.filter(r => r > 0).length;
  return wins / rewards.length;
}

/** Compute ArmMetrics from episode results. */
export function computeArmMetrics(
  results: EpisodeResult[],
  optimalReward: number,
  config: MetricsConfig = {}
): ArmMetrics {
  const rewards = results.map(r => r.reward);
  const wins = results.filter(r => r.win).length;
  const totalEpisodes = results.length;
  const avgReward = mean(rewards);
  const wr = wins / totalEpisodes;
  const std = stdDev(rewards);
  const [rewardCILower, rewardCIUpper] = meanCI(rewards, config.confidenceLevel);
  const [winRateCILower, winRateCIUpper] = proportionCI(wins, totalEpisodes, config.confidenceLevel);
  const bs = brierScore(
    rewards.map(r => Math.max(0, Math.min(1, r))), // Normalize rewards to [0,1] for Brier
    rewards.map(r => r > 0 ? 1 : 0)
  );
  const reg = cumulativeRegret(rewards, optimalReward);
  const cal = calibrationError(
    rewards.map(r => Math.max(0, Math.min(1, r))),
    rewards.map(r => r > 0 ? 1 : 0)
  );

  const fallbackConfig: BaselineArmConfig = {
    algorithm: 'epsilon-greedy',
    config: {},
    habitatType: 'bandit',
    name: 'Unknown',
  };

  return {
    armConfig: results[0]?.armConfig ?? fallbackConfig,
    totalEpisodes,
    totalReward: rewards.reduce((a, b) => a + b, 0),
    avgReward,
    winRate: wr,
    rewardStdDev: std,
    brierScore: bs,
    regret: reg,
    calibrationError: cal,
    rewardCI: [rewardCILower, rewardCIUpper],
    winRateCI: [winRateCILower, winRateCIUpper],
  };
}

/** Compare two arms. */
export function compareArms(
  resultsA: EpisodeResult[],
  resultsB: EpisodeResult[],
  optimalReward: number,
  config: MetricsConfig = {}
): ArmComparison {
  const metricsA = computeArmMetrics(resultsA, optimalReward, config);
  const metricsB = computeArmMetrics(resultsB, optimalReward, config);

  const rewardsA = resultsA.map(r => r.reward);
  const rewardsB = resultsB.map(r => r.reward);

  // Two-sample t-test (simplified)
  const meanA = mean(rewardsA);
  const meanB = mean(rewardsB);
  const stdA = stdDev(rewardsA);
  const stdB = stdDev(rewardsB);
  const nA = rewardsA.length;
  const nB = rewardsB.length;

  const pooledStd = Math.sqrt(((nA - 1) * stdA * stdA + (nB - 1) * stdB * stdB) / (nA + nB - 2));
  const tStat = (meanA - meanB) / (pooledStd * Math.sqrt(1 / nA + 1 / nB));
  const df = nA + nB - 2;

  // Approximate p-value for two-tailed t-test
  const pValue = 2 * (1 - studentTCdf(Math.abs(tStat), df));

  // Cohen's d
  const effectSize = (meanA - meanB) / pooledStd;

  const significant = pValue < 0.05;
  let betterArm: 'A' | 'B' | 'tie' = 'tie';
  if (significant) {
    betterArm = meanA > meanB ? 'A' : 'B';
  }

  return {
    armA: metricsA,
    armB: metricsB,
    pValue,
    significant,
    effectSize,
    betterArm,
  };
}

/** Student's t-distribution CDF approximation. */
function studentTCdf(t: number, df: number): number {
  if (df <= 0) return 0;
  // Approximation using the regularized incomplete beta function
  // For large df, t-distribution approaches normal
  if (df > 100) {
    // Math.erf polyfill for older targets
    const erf = (x: number) => {
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x);
      const a1 = 0.254829592;
      const a2 = -0.284496736;
      const a3 = 1.421413741;
      const a4 = -1.453152027;
      const a5 = 1.061405429;
      const p = 0.3275911;
      const t = 1 / (1 + p * x);
      const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return sign * y;
    };
    return 0.5 * (1 + erf(t / Math.sqrt(2)));
  }
  // Simple approximation for smaller df
  const x = df / (t * t + df);
  const a = df / 2;
  const b = 0.5;
  // Use symmetry and incomplete beta approximation
  return 1 - 0.5 * Math.pow(x, a) * (1 + a * (1 - x) / (b + 1));
}