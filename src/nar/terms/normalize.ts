import type { Term, CompoundTerm, AtomicTerm } from './types.js';
import { computeHash } from './types.js';

function hasArgs(term: Term): term is CompoundTerm {
    return (
        term.kind === 'conjunction' ||
        term.kind === 'disjunction' ||
        term.kind === 'inheritance' ||
        term.kind === 'similarity' ||
        term.kind === 'negation' ||
        term.kind === 'implication' ||
        term.kind === 'equivalence'
    );
}

export function normalize(term: Term): Term {
    // Only conjunction and disjunction are commutative and need ordering.
    if (term.kind === 'conjunction' || term.kind === 'disjunction') {
        const args = term.args ?? [];
        if (args.length <= 1) return term;
        const sortedArgs = [...args].sort((a, b) => a.hash - b.hash);
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
    if (order === 'pre-order') {
        visitor(term);
    }

    if (hasArgs(term)) {
        for (const arg of term.args) {
            visit(arg, visitor, order);
        }
    }

    if (order === 'post-order') {
        visitor(term);
    }
}

export interface TermReducerFn<T> {
    (acc: T, term: Term): T;
}

export function reduce<T>(term: Term, fn: TermReducerFn<T>, initial: T): T {
    let acc = fn(initial, term);

    if (hasArgs(term)) {
        for (const arg of term.args) {
            acc = reduce(arg, fn, acc);
        }
    }

    return acc;
}

export function getTermDepth(term: Term): number {
    if (term.kind === 'atom' || !hasArgs(term)) return 0;
    const depths = term.args.map((arg: Term) => getTermDepth(arg));
    return 1 + Math.max(0, ...depths);
}

export function getTermSize(term: Term): number {
    if (term.kind === 'atom') return 1;
    const args = term.args ?? [];
    return 1 + args.reduce((sum: number, arg: Term) => sum + getTermSize(arg), 0);
}
