/**
 * Performance pattern analysis - extracted from SelfAnalyzerService
 */
import { mean, rankBy, safeRatio } from '@senars/util';

import type { ModelRuleStats } from '../../../lm';
import type { SelfHost } from '../../../self/host.js';
import type { PerformancePatterns } from '../../types.js';
import { getMemory } from './constants.js';

/** Mean per-rule duration, or 0 when no rule has run. An unmeasured mean is not
 *  a fast mean: every caller thresholds on it, so 0 is the honest answer for
 *  "nothing to average". */
export const averageRuleDuration = (rules: readonly ModelRuleStats[] | null): number =>
  mean(rules ?? [], (r) => r.stats.averageDuration);

export const analyzePerformancePatterns = (rules: readonly ModelRuleStats[] | null): PerformancePatterns => {
  const avgDuration = averageRuleDuration(rules);

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

export const identifySuccessfulStrategies = (rules: readonly ModelRuleStats[] | null): string[] => {
  if (!rules?.length) return [];

  return rankBy(rules, (r) => r.stats.successRate, {
    where: (r) => r.stats.successfulCalls > 0,
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
