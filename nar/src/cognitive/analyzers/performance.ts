/**
 * Performance pattern analysis - extracted from SelfAnalyzerService
 */
import type { MetricsCollector } from '../../metrics';
import type { NAR } from '../../nar.js';
import type { PerformancePatterns } from '../types.js';

const calcAvg = (values: number[]): number =>
  values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

const getMemory = () =>
  typeof process.memoryUsage === 'function' ? process.memoryUsage() : ({} as NodeJS.MemoryUsage);

export const analyzePerformancePatterns = (metrics: MetricsCollector | null): PerformancePatterns => {
  const ruleStats = metrics?.getRuleStats();
  const avgDuration = Array.isArray(ruleStats)
    ? calcAvg(ruleStats.map((s) => s.averageDuration))
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

export const analyzeTaskPatterns = (
  nar: NAR | null,
  metrics: MetricsCollector | null
) => {
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