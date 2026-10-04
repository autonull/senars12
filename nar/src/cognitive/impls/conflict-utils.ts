import { getOrInsert, wordOverlap } from '@senars/util';
import type { Term } from '../../terms';
import { TermMap } from '../../terms';
import type { Task } from '../../types';
import { DEFAULT_DIVERGENCE_GAP } from '../../utils/divergence.js';

export { DEFAULT_DIVERGENCE_GAP, hasDivergence } from '../../utils/divergence.js';

export interface ConflictPair {
  a: Term;
  b: Term;
}

export const findConflicts = (beliefs: Task[], gap = DEFAULT_DIVERGENCE_GAP): ConflictPair[] => {
  const byTerm = new TermMap<Array<{ term: Term; f: number }>>();
  for (const b of beliefs) {
    if (!b.truth) continue;
    getOrInsert(byTerm, b.term, () => []).push({ term: b.term, f: b.truth.f });
  }
  const conflicts: ConflictPair[] = [];
  for (const truths of byTerm.values()) {
    for (let i = 0; i < truths.length; i++) {
      for (let j = i + 1; j < truths.length; j++) {
        if (Math.abs(truths[i]!.f - truths[j]!.f) > gap) {
          conflicts.push({ a: truths[i]!.term, b: truths[j]!.term });
        }
      }
    }
  }
  return conflicts;
};

export const countContradictions = (beliefs: Task[], gap = DEFAULT_DIVERGENCE_GAP): number =>
  findConflicts(beliefs, gap).length;

export const termOverlap = (a: string, b: string): number =>
  wordOverlap(a, b, /[\s_()[\]<>\-/=>]+/);