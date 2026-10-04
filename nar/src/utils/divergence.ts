/**
 * Whether a set of frequencies asserted about one subject contradicts itself.
 *
 * Two beliefs about the same subject whose frequencies diverge past a gap are a
 * contradiction; beliefs about different subjects are not comparable at all. This
 * is the test, and the threshold, that contradiction detection and hard-negative
 * mining both ask — one to count contradictory subjects, the other to mine one
 * negative per subject — so a single declaration is what keeps "what counts as a
 * contradiction" from having two answers.
 */

/** How far apart two frequencies about one subject must be to be contradictory. */
export const DEFAULT_DIVERGENCE_GAP = 0.3;

/**
 * The comparison is pairwise and stops at the first divergent pair, because the
 * question is always "does this subject contradict itself", never "how many
 * ways". The O(n²) scan therefore only runs over the beliefs sharing a subject.
 */
export const hasDivergence = (
  frequencies: readonly number[],
  gap: number = DEFAULT_DIVERGENCE_GAP
): boolean => {
  for (let j = 1; j < frequencies.length; j++) {
    for (let i = 0; i < j; i++) {
      if (Math.abs(frequencies[j]! - frequencies[i]!) > gap) return true;
    }
  }
  return false;
};
