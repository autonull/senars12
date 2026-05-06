import type { Term, CompoundTerm } from '../terms/index.js';

export type Guard<T extends Term = Term> = (term: T) => boolean;

function hasArgs(term: Term): term is CompoundTerm {
    return term.kind === 'conjunction' || term.kind === 'disjunction' ||
           term.kind === 'inheritance' || term.kind === 'similarity' ||
           term.kind === 'negation' || term.kind === 'implication' || term.kind === 'equivalence';
}

export function composeGuards<T extends Term>(...guards: Guard<T>[]): Guard<T> {
    return (term: T) => guards.every(g => g(term));
}

export function andGuards<T extends Term>(...guards: Guard<T>[]): Guard<T> {
    return composeGuards(...guards);
}

export function orGuards<T extends Term>(...guards: Guard<T>[]): Guard<T> {
    return (term: T) => guards.some(g => g(term));
}

export function notGuard<T extends Term>(guard: Guard<T>): Guard<T> {
    return (term: T) => !guard(term);
}

export const Guards = {
    isAtomic: (term: Term): boolean => term.kind === 'atom',

    isCompound: (term: Term): boolean => hasArgs(term),

    hasOperator: (op: string) => (term: Term): boolean => term.kind === op,

    hasArity: (arity: number) => (term: Term): boolean => 
        term.kind === 'atom' ? arity === 0 : hasArgs(term) && term.args.length === arity
};