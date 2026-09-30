import { selectTopN } from '@senars/util';

import { calculateSimilarity, type Term } from '../terms';
import type { Concept } from './concept.js';

/**
 * The one similarity ranking in memory: the `limit` most similar candidates,
 * most similar first, from any candidate source. Candidates sharing no symbol
 * with the query are dropped — a "similar concept" that scored zero is a worse
 * answer than none, and returning filler silently is how an unindexed store
 * used to answer every unrelated query.
 *
 * Each candidate is scored exactly once and carried alongside itself, because
 * the zero-score filter and the ranking need the same number and only the
 * ranking kept a reference to the call. The pairs are still produced lazily, so
 * an unbounded candidate set is never materialized.
 */
export const selectSimilar = (
  candidates: Iterable<Concept>,
  term: Term,
  limit: number
): Concept[] => {
  if (limit <= 0) return [];
  const scored = (function* () {
    for (const candidate of candidates) {
      const score = calculateSimilarity(term, candidate.term);
      if (score > 0) yield [candidate, score] as const;
    }
  })();
  return selectTopN(scored, limit, ([, score]) => score).map(([concept]) => concept);
};
