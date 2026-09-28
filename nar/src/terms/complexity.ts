import { isAtomic, type Term } from './types.js';
import { walkTerms } from './accessors.js';

export const getTermComplexity = (
  term: Term
): {
  depth: number;
  breadth: number;
  operatorCount: number;
  variableCount: number;
} => {
  let depth = 0;
  let breadth = 0;
  let operatorCount = 0;
  let variableCount = 0;

  walkTerms(term, (t, d) => {
    depth = Math.max(depth, d);
    if (isAtomic(t)) {
      if (t.isVariable) variableCount++;
      return;
    }
    operatorCount++;
    breadth = Math.max(breadth, t.args?.length ?? 0);
  });

  return { depth, breadth, operatorCount, variableCount };
};
