/**
 * Performance pattern analysis - extracted from SelfAnalyzerService
 */
import { mean } from '@senars/util';

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
  const stats = Array.isArray(ruleStats) ? ruleStats : [];
  if (!stats.length) return [];

  return stats
    .filter((s) => s.successes > 0 && s.executions > 0)
    .sort((a, b) => b.successes / b.executions - a.successes / a.executions)
    .slice(0, 5)
    .map((s) => s.id);
};

export const analyzeTaskPatterns = (nar: SelfHost | null, metrics: MetricsCollector | null) => {
  if (!nar || !metrics) {
    return { avgProcessingTime: 0, queueDepth: 0, dropRate: 0 };
  }
  const summary = nar.getMetrics?.();
  return {
    avgProcessingTime: summary?.throughput?.averageStepDuration ?? 0,
    queueDepth: 0,
    dropRate: 0,
  };
};
