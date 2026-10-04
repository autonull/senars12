import { maxScore, rankBy } from '@senars/util';
import { atomicSymbols, containsSubterm, type Term, termKey } from '../terms/index.js';

/**
 * Relevance — how much a committed belief bears on what is currently being
 * asked. TODO30 §1.2's option B: a read-path score, deliberately, because
 * `rankDerivations` decides what is *admitted* and §7 invariant 1 makes that
 * set untouchable. Nothing here writes; the store is unchanged by being read
 * differently.
 *
 * The score is pure and structural: `termKey` for an exact hit, node coverage
 * next, and vocabulary overlap last. No truth value is consulted — relevance is
 * a property of *which claim is about what*, so a belief at f=0.5 that names
 * the question outranks a belief at f=0.99 that does not.
 */

/**
 * The three bands, and the gap between them is the point:
 *
 * | band | score | means |
 * |---|---|---|
 * | exact | {@link RELEVANCE_EXACT} | the belief *is* what was asked |
 * | containment | {@link RELEVANCE_CONTAINMENT} | the asked term sits inside the belief, so the belief is about it |
 * | vocabulary | below containment | two terms share words — which every intersection of the question's premises does, and is why the band is a floor rather than a rank |
 */
export const RELEVANCE_EXACT = 1;

/** The default floor: exact hits and containment, nothing that merely shares vocabulary. */
export const RELEVANCE_CONTAINMENT = 0.75;

/** How far into the vocabulary band a perfect share of words can reach. */
const VOCABULARY_CEILING = 0.9;

/** How much of a belief's vocabulary a focus term names, in `[0, 1]`. */
const coverage = (beliefSymbols: ReadonlySet<string>, focus: Term): number => {
  let shared = 0;
  for (const symbol of atomicSymbols(focus)) if (beliefSymbols.has(symbol)) shared++;
  return shared / beliefSymbols.size;
};

/**
 * The relevance of one belief to a set of focus terms — the open questions and
 * goals. Pure: the same `(belief, focus)` always yields the same number, and
 * nothing about the store or its truth values is read.
 *
 * Two bands, in order. **Containment** — the focus term sits inside the belief,
 * so the belief is about what was asked — scores above **vocabulary**, where
 * two terms merely share words. The split matters because §0.2's 133 beliefs are
 * mostly intersections: they share every word with the question and none of its
 * structure, and a single blended score would rank them with the answer.
 */
export const relevanceScore = (belief: Term, focus: readonly Term[]): number => {
  if (focus.length === 0) return 0;

  const beliefKey = termKey(belief);
  if (focus.some((term) => termKey(term) === beliefKey)) return RELEVANCE_EXACT;

  const contained = maxScore(focus, (term) =>
    containsSubterm(belief, term) ? RELEVANCE_CONTAINMENT : 0
  );
  if (contained > 0) return contained;

  // Vocabulary is capped strictly below containment, or a belief sharing every
  // word with the focus would clear the containment floor.
  // The belief's vocabulary is one walk of the belief, and it was re-derived for each
  // focus term rather than read once per belief.
  const beliefSymbols = atomicSymbols(belief);
  const ceiling = RELEVANCE_CONTAINMENT * VOCABULARY_CEILING;
  return maxScore(focus, (term) => coverage(beliefSymbols, term) * ceiling);
};

export interface RelevanceOptions {
  /** The open questions and goals a reader cares about. Empty ⇒ nothing ranks. */
  readonly focus: readonly Term[];
  /**
   * Drop everything below this. Defaults to {@link RELEVANCE_CONTAINMENT} — the
   * vocabulary band is a *rank*, not a floor, because §0.2's 129 leftovers all
   * share every word with the question. Pass `0` to keep them all and rank.
   */
  readonly minScore?: number;
}

/** {@link relevanceScore}, filtered and stably ordered by descending score. */
export const byRelevance = <T extends { term: Term }>(
  tasks: readonly T[],
  options: RelevanceOptions
): T[] => {
  const floor = options.minScore ?? RELEVANCE_CONTAINMENT;
  return rankBy(tasks, (task) => relevanceScore(task.term, options.focus), {
    where: (_task, score) => score >= floor,
  });
};
