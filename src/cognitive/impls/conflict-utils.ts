import { getOrInsert } from '@senars/util';
import { TermMap } from '../../terms';
import type { Task } from '../../types';
import { DEFAULT_DIVERGENCE_GAP, hasDivergence } from '../../utils/divergence.js';

export { DEFAULT_DIVERGENCE_GAP, hasDivergence } from '../../utils/divergence.js';

/**
 * How many subjects contradict themselves.
 *
 * The scan is per subject, not per pair: `hasDivergence` already answers the
 * subject question and stops at the first divergent pair, so the pair list this
 * replaced was built only to have its length read — one object per conflicting
 * pair, per cycle, thrown away. Buckets by term first, because beliefs about
 * different subjects are not comparable at all.
 */
export const countContradictions = (beliefs: readonly Task[], gap = DEFAULT_DIVERGENCE_GAP): number => {
  const frequenciesByTerm = new TermMap<number[]>();
  for (const belief of beliefs) {
    if (!belief.truth) continue;
    getOrInsert(frequenciesByTerm, belief.term, () => []).push(belief.truth.f);
  }

  let contradictions = 0;
  for (const frequencies of frequenciesByTerm.values()) {
    if (hasDivergence(frequencies, gap)) contradictions++;
  }
  return contradictions;
};
