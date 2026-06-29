import type {Term} from './types.js';

export const getTermComplexity = (term: Term): {
    depth: number;
    breadth: number;
    operatorCount: number;
    variableCount: number;
} => {
    let maxDepth = 0;
    let breadth = 0;
    let operatorCount = 0;
    let variableCount = 0;

    const traverse = (t: Term, depth: number): void => {
        maxDepth = Math.max(maxDepth, depth);
        if (t.kind === 'atom') {
            if (t.isVariable) variableCount++;
        } else {
            operatorCount++;
            breadth = Math.max(breadth, t.args?.length ?? 0);
            for (const arg of t.args ?? []) traverse(arg, depth + 1);
        }
    };

    traverse(term, 0);
    return {depth: maxDepth, breadth, operatorCount, variableCount};
};
