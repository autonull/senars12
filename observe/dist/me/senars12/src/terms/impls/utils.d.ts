import type { Term } from '../types';
/**
 * Symbol-bag similarity. The bags are memoized per term, so neither side is
 * re-walked per comparison and no caller has to hoist a query bag of its own.
 */
export declare const calculateSimilarity: (conceptTerm: Term, targetTerm: Term) => number;
//# sourceMappingURL=utils.d.ts.map