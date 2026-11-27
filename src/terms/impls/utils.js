import { jaccard } from '@senars/util/similarity';
import { atomicSymbols, termsEqual } from './accessors';
/**
 * Symbol-bag similarity. The bags are memoized per term, so neither side is
 * re-walked per comparison and no caller has to hoist a query bag of its own.
 */
export const calculateSimilarity = (conceptTerm, targetTerm) => termsEqual(conceptTerm, targetTerm)
    ? 1
    : jaccard(atomicSymbols(conceptTerm), atomicSymbols(targetTerm));
