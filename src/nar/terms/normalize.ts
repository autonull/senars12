import type { Term, CompoundTerm } from './types.js';
import { computeHash } from './types.js';

const hasArgs = (term: Term): term is CompoundTerm =>
  ['conjunction', 'disjunction', 'inheritance', 'similarity', 'negation', 'implication', 'equivalence'].includes(term.kind);

export function normalize(term: Term): Term {
    // Only conjunction and disjunction are commutative and need ordering.
    if (term.kind === 'conjunction' || term.kind === 'disjunction') {
        const args = term.args ?? [];
        if (args.length <= 1) return term;
        const sortedArgs = args.toSorted((a, b) => a.hash - b.hash);
        const allSorted = sortedArgs.every((arg, i) => arg.hash === args[i]?.hash);
        if (!allSorted) {
            const newHash = computeHash(term.kind, sortedArgs.map(t => t.hash));
            return Object.freeze({ ...term, args: sortedArgs, hash: newHash } as Term);
        }
    }
    return term;
}

export interface TermVisitorFn<T> {
    (term: Term): T;
}

export function visit<T>(term: Term, visitor: TermVisitorFn<T>, order: 'pre-order' | 'post-order' = 'pre-order'): void {
  if (order === 'pre-order') visitor(term);
  if (hasArgs(term)) {
    for (const arg of term.args) visit(arg, visitor, order);
  }
  if (order === 'post-order') visitor(term);
}

export interface TermReducerFn<T> {
    (acc: T, term: Term): T;
}

export function reduce<T>(term: Term, fn: TermReducerFn<T>, initial: T): T {
  let acc = fn(initial, term);
  if (hasArgs(term)) {
    for (const arg of term.args) acc = reduce(arg, fn, acc);
  }
  return acc;
}

export const getTermDepth = (term: Term): number => {
  if (term.kind === 'atom' || !hasArgs(term)) return 0;
  return 1 + Math.max(0, ...term.args.map(getTermDepth));
};

export const getTermSize = (term: Term): number => {
  if (term.kind === 'atom') return 1;
  return 1 + term.args.reduce((sum, arg) => sum + getTermSize(arg), 0);
};
