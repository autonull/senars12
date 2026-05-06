import type { Term, CompoundTerm, AtomicTerm } from './types.js';

function isCompound(term: Term): term is CompoundTerm {
    return term.kind === 'conjunction' || term.kind === 'disjunction' ||
           term.kind === 'inheritance' || term.kind === 'similarity' ||
           term.kind === 'negation' || term.kind === 'implication' || term.kind === 'equivalence';
}

function hasArgs(term: Term): term is CompoundTerm {
    return isCompound(term);
}

export function normalize(term: Term): Term {
    if (term.kind !== 'atom' && (term.kind === 'conjunction' || term.kind === 'disjunction')) {
        const sortedArgs = [...term.args].sort((a, b) => a.hash - b.hash);
        const allSorted = sortedArgs.every((arg, i) => arg.hash === term.args[i]?.hash);
        if (!allSorted) {
            return { ...term, args: sortedArgs };
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