/**
 * Resource usage analysis - extracted from SelfAnalyzerService
 */
import { mean } from '@senars/util/numeric';

import type { Concept } from '../../../memory/concept';
import type { SelfHost } from '../../../self/host';
import type { ResourceUsage } from '../../types';
import { getMemory } from './constants';

export const getResourceAnalysis = (
  nar: SelfHost | null
): Omit<ResourceUsage, 'highPriorityConcepts' | 'lowPriorityConcepts'> => {
  if (!nar) return { conceptCount: 0, avgConceptPriority: 0, memoryUsage: getMemory() };
  const concepts = nar.listConcepts();
  return {
    conceptCount: concepts.length,
    avgConceptPriority: mean(concepts.map((c) => c.priority)),
    memoryUsage: getMemory(),
  };
};

export const analyzeResourceUsage = (concepts: Concept[]): ResourceUsage => {
  const priorities = concepts.map((c) => c.priority);
  return {
    conceptCount: concepts.length,
    memoryUsage: getMemory(),
    avgConceptPriority: mean(priorities),
    highPriorityConcepts: concepts.filter((c) => c.priority > 0.7).length,
    lowPriorityConcepts: concepts.filter((c) => c.priority < 0.3).length,
  };
};
