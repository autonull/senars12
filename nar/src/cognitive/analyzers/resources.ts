/**
 * Resource usage analysis - extracted from SelfAnalyzerService
 */
import type { Concept } from '../../memory';
import type { MetricsCollector, NAR } from '../../nar.js';
import type { ResourceUsage } from '../types.js';
import { calcAvg, getMemory } from './constants.js';

export const getResourceAnalysis = (
  nar: NAR | null,
  metrics: MetricsCollector | null
): Omit<ResourceUsage, 'highPriorityConcepts' | 'lowPriorityConcepts'> => {
  if (!nar) return { conceptCount: 0, avgConceptPriority: 0, memoryUsage: getMemory() };
  const concepts = nar.listConcepts();
  return {
    conceptCount: concepts.length,
    avgConceptPriority: calcAvg(concepts.map((c) => c.priority)),
    memoryUsage: getMemory(),
  };
};

export const analyzeResourceUsage = (concepts: Concept[]): ResourceUsage => {
  const priorities = concepts.map((c) => c.priority);
  return {
    conceptCount: concepts.length,
    memoryUsage: getMemory(),
    avgConceptPriority: calcAvg(priorities),
    highPriorityConcepts: concepts.filter((c) => c.priority > 0.7).length,
    lowPriorityConcepts: concepts.filter((c) => c.priority < 0.3).length,
  };
};
