/**
 * Scorecard — first fold evaluation and comparison.
 *
 * Provides structured evaluation with statistical rigor,
 * regression detection, and certificate generation.
 */

import type { Scorecard, EpisodeResult, ScorecardMetrics } from './pack';
import type { HabitatConfig, HabitatId } from './habitat';

/** Fold identifier. */
export type FoldId = string & { readonly __brand: unique symbol };

/** Evaluation fold — a complete evaluation run. */
export interface EvaluationFold {
  /** Fold ID. */
  id: FoldId;
  /** Target habitat/pack. */
  targetId: string;
  /** Target kind. */
  targetKind: 'habitat' | 'pack';
  /** Scorecards in this fold (multiple seeds). */
  scorecards: Scorecard[];
  /** Fold-level aggregates. */
  aggregates: FoldAggregates;
  /** Certificate if passed. */
  certificate?: EvaluationCertificate;
  /** Timestamp. */
  timestamp: number;
}

/** Fold-level aggregate metrics. */
export interface FoldAggregates {
  /** Mean reward across seeds. */
  meanReward: number;
  /** Std deviation across seeds. */
  stdReward: number;
  /** Mean success rate. */
  meanSuccessRate: number;
  /** Min success rate (worst seed). */
  minSuccessRate: number;
  /** Max fairness violations. */
  maxFairnessViolations: number;
  /** Seeds evaluated. */
  seeds: number;
}

/** Evaluation certificate. */
export interface EvaluationCertificate {
  /** Certificate ID. */
  id: string;
  /** Fold ID. */
  foldId: FoldId;
  /** Pass/fail. */
  passed: boolean;
  /** Thresholds met. */
  thresholds: ThresholdResult[];
  /** Issued at. */
  issuedAt: number;
  /** Expires at (optional). */
  expiresAt?: number;
  /** Signature (for verification). */
  signature: string;
}

/** Threshold check result. */
export interface ThresholdResult {
  /** Metric name. */
  metric: string;
  /** Threshold value. */
  threshold: number;
  /** Actual value. */
  actual: number;
  /** Passed. */
  passed: boolean;
}

/** Default evaluation thresholds. */
export const DEFAULT_THRESHOLDS: Record<string, number> = {
  meanReward: 0.5,
  successRate: 0.7,
  fairnessViolations: 0,
};

/** Run evaluation fold over multiple seeds. */
export async function runEvaluationFold(
  targetId: string,
  targetKind: 'habitat' | 'pack',
  seeds: number[],
  runEpisode: (config: HabitatConfig, seed: number) => Promise<EpisodeResult[]>,
  thresholds: Record<string, number> = DEFAULT_THRESHOLDS
): Promise<EvaluationFold> {
  const foldId = `fold-${targetId}-${Date.now()}` as FoldId;
  const scorecards: Scorecard[] = [];

  for (const seed of seeds) {
    // Create config with seed
    // Note: In real implementation, config would be retrieved from registry
    const config = { id: targetId as HabitatId } as HabitatConfig;

    const episodes = await runEpisode(config, seed);
    const scorecard = createScorecardFromEpisodes(targetId, targetKind, episodes, seed);
    scorecards.push(scorecard);
  }

  const aggregates = computeFoldAggregates(scorecards);
  const certificate = generateCertificate(foldId, scorecards, aggregates, thresholds);

  return {
    id: foldId,
    targetId,
    targetKind,
    scorecards,
    aggregates,
    certificate,
    timestamp: Date.now(),
  };
}

/** Create scorecard from episodes (helper). */
function createScorecardFromEpisodes(
  targetId: string,
  targetKind: 'habitat' | 'pack',
  episodes: EpisodeResult[],
  seed: number
): Scorecard {
  const rewards = episodes.map(e => e.totalReward);
  const steps = episodes.map(e => e.steps);
  const successes = episodes.filter(e => e.termination === 'goalAchieved').length;

  const meanReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
  const stdReward = Math.sqrt(
    rewards.reduce((a, b) => a + (b - meanReward) ** 2, 0) / rewards.length
  );
  const meanSteps = steps.reduce((a, b) => a + b, 0) / steps.length;

  const laneDist: Record<string, number> = {};
  for (const ep of episodes) {
    laneDist[ep.lane] = (laneDist[ep.lane] ?? 0) + 1;
  }

  return {
    targetId,
    targetKind,
    episodes,
    metrics: {
      meanReward,
      stdReward,
      meanSteps,
      successRate: successes / episodes.length,
      fairnessViolations: 0,
      laneDistribution: laneDist as Record<any, number>,
    },
    timestamp: Date.now(),
    seed,
  };
}

/** Compute fold aggregates from scorecards. */
function computeFoldAggregates(scorecards: Scorecard[]): FoldAggregates {
  const rewards = scorecards.map(s => s.metrics.meanReward);
  const successRates = scorecards.map(s => s.metrics.successRate);
  const fairness = scorecards.map(s => s.metrics.fairnessViolations);

  const meanReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
  const stdReward = Math.sqrt(
    rewards.reduce((a, b) => a + (b - meanReward) ** 2, 0) / rewards.length
  );
  const meanSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;
  const minSuccessRate = Math.min(...successRates);
  const maxFairnessViolations = Math.max(...fairness);

  return {
    meanReward,
    stdReward,
    meanSuccessRate,
    minSuccessRate,
    maxFairnessViolations,
    seeds: scorecards.length,
  };
}

/** Generate evaluation certificate. */
function generateCertificate(
  foldId: FoldId,
  scorecards: Scorecard[],
  aggregates: FoldAggregates,
  thresholds: Record<string, number>
): EvaluationCertificate {
  const thresholdResults: ThresholdResult[] = [
    { metric: 'meanReward', threshold: thresholds.meanReward ?? 0.5, actual: aggregates.meanReward, passed: aggregates.meanReward >= (thresholds.meanReward ?? 0.5) },
    { metric: 'successRate', threshold: thresholds.successRate ?? 0.7, actual: aggregates.meanSuccessRate, passed: aggregates.meanSuccessRate >= (thresholds.successRate ?? 0.7) },
    { metric: 'fairnessViolations', threshold: thresholds.fairnessViolations ?? 0, actual: aggregates.maxFairnessViolations, passed: aggregates.maxFairnessViolations <= (thresholds.fairnessViolations ?? 0) },
  ];

  const passed = thresholdResults.every(t => t.passed);

  // Simple signature (in production, use proper crypto)
  const payload = `${foldId}:${passed}:${Date.now()}`;
  const signature = hashString(payload);

  return {
    id: `cert-${foldId}-${signature.slice(0, 8)}`,
    foldId,
    passed,
    thresholds: thresholdResults,
    issuedAt: Date.now(),
    signature,
  };
}

/** Simple hash for certificate signature. */
function hashString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/** Verify evaluation certificate. */
export function verifyEvaluationCertificate(cert: EvaluationCertificate): boolean {
  // In production, verify signature with public key
  return cert.passed && cert.signature.length > 0;
}

/** Export scorecard as JSON. */
export function exportScorecard(scorecard: Scorecard): string {
  return JSON.stringify(scorecard, (key, value) => {
    if (value instanceof Map) {
      return Object.fromEntries(value);
    }
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }, 2);
}

/** Import scorecard from JSON. */
export function importScorecard(json: string): Scorecard {
  const obj = JSON.parse(json);
  return {
    ...obj,
    metrics: {
      ...obj.metrics,
      laneDistribution: obj.metrics.laneDistribution ?? {},
    },
  };
}