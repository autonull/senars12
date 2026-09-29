import { selectTopN } from '@senars/util';

import { similarityTo, symbolQuery, type Term } from '../terms';
import type { Concept } from './concept.js';

/**
 * The one similarity ranking in memory: the `limit` most similar candidates,
 * most similar first, from any candidate source. Candidates sharing no symbol
 * with the query are dropped — a "similar concept" that scored zero is a worse
 * answer than none, and returning filler silently is how an unindexed store
 * used to answer every unrelated query.
 *
 * Each candidate is scored twice (the floor, then the rank) so an unbounded
 * candidate set never has to be materialized.
 */
export const selectSimilar = (
  candidates: Iterable<Concept>,
  term: Term,
  limit: number
): Concept[] => {
  if (limit <= 0) return [];
  const query = symbolQuery(term);
  const similar = (function* () {
    for (const candidate of candidates) {
      if (similarityTo(query, candidate.term) > 0) yield candidate;
    }
  })();
  return selectTopN(similar, limit, (candidate) => similarityTo(query, candidate.term));
};
