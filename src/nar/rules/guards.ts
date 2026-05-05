import type { Term } from '../terms/index.js';

export type Guard<T extends Term = Term> = (term: T) => boolean;

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

    isCompound: (term: Term): boolean => term.kind !== 'atom',

    hasOperator: (op: string) => (term: Term): boolean => term.kind === op,

    hasArity: (arity: number) => (term: Term): boolean => 
        term.kind === 'atom' ? arity === 0 : term.args?.length === arity
};