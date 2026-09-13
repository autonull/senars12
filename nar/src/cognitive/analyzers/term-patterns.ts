/**
 * Term pattern analysis - extracted from SelfAnalyzerService
 */
import type { Concept } from '../../memory';
import type { TermPattern } from '../types.js';

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
    const sum = data.priorities.reduce((a, b) => a + b, 0);
    const avgPriority = sum / data.priorities.length;
    results.push({
      term,
      frequency: data.count,
      coOccurrences: data.coOccurrences,
      avgPriority,
      lastSeen: Date.now(),
    });
  }

  return results.sort((a, b) => b.frequency - a.frequency).slice(0, 50);
};
