/**
 * Reasoning pattern analysis - extracted from SelfAnalyzerService
 */
import type { NAR, MetricsCollector } from '../../nar.js';
import type { MetacognitiveMonitor } from '../MetacognitiveMonitor.js';
import type { PatternAnalysis, InferenceChain, ReasoningStep } from '../types.js';
import { EMPTY_PATTERN } from './constants.js';
import { analyzeTermPatterns } from './term-patterns.js';
import { analyzePerformancePatterns, identifySuccessfulStrategies, analyzeTaskPatterns } from './performance.js';
import { analyzeResourceUsage } from './resources.js';

export const analyzeReasoningPatterns = async (
  nar: NAR | null,
  monitor: MetacognitiveMonitor,
  metrics: MetricsCollector | null
): Promise<PatternAnalysis> => {
  if (!nar) return EMPTY_PATTERN;
  const concepts = nar.listConcepts();
  return {
    frequentPatterns: analyzeTermPatterns(concepts),
    inefficientChains: detectInefficientChains(monitor),
    successfulStrategies: identifySuccessfulStrategies(metrics),
    performancePatterns: analyzePerformancePatterns(metrics),
    resourceUsage: analyzeResourceUsage(concepts),
    taskProcessingPatterns: analyzeTaskPatterns(nar, metrics),
  };
};

export const detectInefficientChains = (monitor: MetacognitiveMonitor): InferenceChain[] => {
  const monitorState = monitor.getMonitorState();
  if (!monitorState?.reasoningTrace) return [];
  return monitorState.reasoningTrace.slice(-100).reduce<InferenceChain[]>((acc, entry: ReasoningStep) => {
    if (entry.stepData?.duration !== undefined && entry.stepData.duration > 1000) {
      return [
        ...acc,
        {
          startTerm: entry.stepData.startTerm || 'unknown',
          endTerm: entry.stepData.endTerm || 'unknown',
          length: 1,
          success: entry.stepData.success ?? false,
          duration: entry.stepData.duration,
        },
      ];
    }
    return acc;
  }, []);
};