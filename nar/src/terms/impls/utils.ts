import { jaccard } from '../../utils/similarity.js';
import type { Term } from '../types.js';
import { atomicSymbols, termsEqual } from './accessors.js';

/**
 * Symbol-bag similarity. The bags are memoized per term, so neither side is
 * re-walked per comparison and no caller has to hoist a query bag of its own.
 */
export const calculateSimilarity = (conceptTerm: Term, targetTerm: Term): number =>
  termsEqual(conceptTerm, targetTerm)
    ? 1
    : jaccard(atomicSymbols(conceptTerm), atomicSymbols(targetTerm));
