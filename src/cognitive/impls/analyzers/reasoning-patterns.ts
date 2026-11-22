import type { ModelRuleStats } from '../../../lm';
/**
 * Reasoning pattern analysis - extracted from SelfAnalyzerService
 */
import { takeLast } from '@senars/util/collections';
import type { SelfHost } from '../../../self/host';
import type { InferenceChain, PatternAnalysis, ReasoningStep } from '../../types';
import type { MetacognitiveMonitor } from '../MetacognitiveMonitor';
import { EMPTY_PATTERN } from './constants';
import {
  analyzePerformancePatterns,
  analyzeTaskPatterns,
  identifySuccessfulStrategies,
} from './performance';
import { analyzeResourceUsage } from './resources';
import { analyzeTermPatterns } from './term-patterns';

export const analyzeReasoningPatterns = async (
  nar: SelfHost | null,
  monitor: MetacognitiveMonitor,
  ruleStats: readonly ModelRuleStats[] | null = null
): Promise<PatternAnalysis> => {
  if (!nar) return EMPTY_PATTERN;
  const concepts = nar.listConcepts();
  return {
    frequentPatterns: analyzeTermPatterns(concepts),
    inefficientChains: detectInefficientChains(monitor),
    successfulStrategies: identifySuccessfulStrategies(ruleStats),
    performancePatterns: analyzePerformancePatterns(ruleStats),
    resourceUsage: analyzeResourceUsage(concepts),
    taskProcessingPatterns: analyzeTaskPatterns(nar),
  };
};

export const detectInefficientChains = (monitor: MetacognitiveMonitor): InferenceChain[] => {
  const monitorState = monitor.getMonitorState();
  if (!monitorState?.reasoningTrace) return [];
  return takeLast(monitorState.reasoningTrace, 100).reduce<InferenceChain[]>(
    (acc, entry: ReasoningStep) => {
      if (entry.stepData?.duration !== undefined && entry.stepData.duration > 1000) {
        acc.push({
          startTerm: entry.stepData.startTerm || 'unknown',
          endTerm: entry.stepData.endTerm || 'unknown',
          length: 1,
          success: entry.stepData.success ?? false,
          duration: entry.stepData.duration,
        });
      }
      return acc;
    },
    []
  );
};
