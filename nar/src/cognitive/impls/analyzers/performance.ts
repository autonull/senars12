/**
 * Performance pattern analysis - extracted from SelfAnalyzerService
 */
import { mean, rankBy, safeRatio } from '@senars/util';

import type { MetricsCollector } from '../../../metrics';
import type { SelfHost } from '../../../self/host.js';
import type { PerformancePatterns } from '../../types.js';
import { getMemory } from './constants.js';

/** Mean per-rule duration, or 0 when the collector reports no rules. An
 *  unmeasured mean is not a fast mean: every caller thresholds on it, so 0 is
 *  the honest answer for "nothing to average". */
export const averageRuleDuration = (
  metrics: Pick<MetricsCollector, 'getRuleStats'> | null | undefined
): number => {
  const ruleStats = metrics?.getRuleStats();
  return Array.isArray(ruleStats) ? mean(ruleStats, (r) => r.averageDuration) : 0;
};

export const analyzePerformancePatterns = (
  metrics: MetricsCollector | null
): PerformancePatterns => {
  const avgDuration = averageRuleDuration(metrics);

  let memoryUsage = 0;
  try {
    const { heapUsed, heapTotal } = getMemory();
    memoryUsage = (heapUsed + heapTotal) / 2;
  } catch {
    memoryUsage = 0;
  }

  return {
    ruleExecution: avgDuration,
    memoryUsage,
    throughput: 'stable' as const,
  };
};

export const identifySuccessfulStrategies = (metrics: MetricsCollector | null): string[] => {
  const ruleStats = metrics?.getRuleStats();
  if (!ruleStats?.length) return [];

  return rankBy(ruleStats, (r) => r.successRate, {
    where: (r) => r.successfulCalls > 0,
    limit: 5,
  }).map((r) => r.id);
};

/** Elapsed time per derivation, from the counters the kernel actually bumps.
 *  Queue depth and drop rate are still unmeasured, and report 0 rather than a
 *  guess. */
export const analyzeTaskPatterns = (nar: SelfHost | null) => {
  if (!nar) return { avgProcessingTime: 0, queueDepth: 0, dropRate: 0 };
  const { uptime, totalDerivations } = nar.getMetrics().system;
  return { avgProcessingTime: safeRatio(uptime, totalDerivations), queueDepth: 0, dropRate: 0 };
};
