/**
 * Performance pattern analysis - extracted from SelfAnalyzerService
 */
import { mean } from '@senars/util';

import type { MetricsCollector } from '../../metrics';
import type { SelfHost } from '../../self/host.js';
import type { PerformancePatterns } from '../types.js';
import { getMemory } from './constants.js';

export const analyzePerformancePatterns = (
  metrics: MetricsCollector | null
): PerformancePatterns => {
  const ruleStats = metrics?.getRuleStats();
  const avgDuration = Array.isArray(ruleStats)
    ? mean(ruleStats.map((s) => s.averageDuration))
    : 0;

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
