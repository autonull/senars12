/**
 * Term pattern analysis - extracted from SelfAnalyzerService
 */
import { mean, selectTopN } from '@senars/util';
import type { Concept } from '../../../memory/concept.js';
import type { TermPattern } from '../../types.js';

interface TermFreqEntry {
  count: number;
  priorities: number[];
  coOccurrences: Map<string, number>;
}

const EMPTY_PATTERN: TermPattern[] = [];

export const analyzeTermPatterns = (concepts: Concept[]): TermPattern[] => {
  if (!concepts.length) return EMPTY_PATTERN;

  const termFreq = new Map<string, TermFreqEntry>();

  for (const concept of concepts) {
    const termStr = concept.term.toString();
    const existing = termFreq.get(termStr);
    const data: TermFreqEntry = existing ?? { count: 0, priorities: [], coOccurrences: new Map() };
    data.count++;
    data.priorities.push(concept.priority);
    termFreq.set(termStr, data);
  }

  const results: TermPattern[] = [];
  for (const [term, data] of termFreq) {
    if (data.count < 2) continue;
    const avgPriority = mean(data.priorities);
    results.push({
      term,
      frequency: data.count,
      coOccurrences: data.coOccurrences,
      avgPriority,
      lastSeen: Date.now(),
    });
  }

  return selectTopN(results, 50, (r) => r.frequency);
};
