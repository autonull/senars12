import { isAtomic } from '../types';
import { getArgs, walkTerms } from './accessors';
export const getTermComplexity = (term) => {
    let depth = 0;
    let breadth = 0;
    let operatorCount = 0;
    let variableCount = 0;
    walkTerms(term, (t, d) => {
        depth = Math.max(depth, d);
        if (isAtomic(t)) {
            if (t.isVariable)
                variableCount++;
            return;
        }
        operatorCount++;
        breadth = Math.max(breadth, getArgs(t).length);
    });
    return { depth, breadth, operatorCount, variableCount };
};
