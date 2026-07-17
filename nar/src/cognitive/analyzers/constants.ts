/**
 * Constants - extracted from SelfAnalyzerService
 */
import type { PatternAnalysis } from '../types.js';

export const EMPTY_PATTERN: PatternAnalysis = {
  frequentPatterns: [],
  inefficientChains: [],
  successfulStrategies: [],
  performancePatterns: { ruleExecution: 0, memoryUsage: 0, throughput: 'stable' as const },
  resourceUsage: {
    conceptCount: 0,
    memoryUsage: typeof process.memoryUsage === 'function' ? process.memoryUsage() : ({} as NodeJS.MemoryUsage),
    avgConceptPriority: 0,
    highPriorityConcepts: 0,
    lowPriorityConcepts: 0,
  },
  taskProcessingPatterns: { avgProcessingTime: 0, queueDepth: 0, dropRate: 0 },
};

export const calcAvg = (values: number[]): number =>
  values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

export const getMemory = () =>
  typeof process.memoryUsage === 'function' ? process.memoryUsage() : ({} as NodeJS.MemoryUsage);