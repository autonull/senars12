/**
 * Rule builder utilities for deduplicating NAL rule definitions
 */
import type {Term} from '../terms';
import type {RuleFn} from './types.js';

export const buildBinaryInhRule = (
    validate: (t1: Term, t2: Term) => boolean,
    transform: (t1: Term, t2: Term) => Term | undefined
): RuleFn => ([t1, t2]) => {
    if (t1.kind !== 'inheritance' || t2.kind !== 'inheritance') return undefined;
    if (!validate(t1, t2)) return undefined;
    return transform(t1, t2);
};

export const buildInhRule = (
    extract: (term: Term) => Term | undefined,
    transform: (term: Term) => Term | undefined
): RuleFn => ([term]) => {
    if (term.kind !== 'inheritance') return undefined;
    const extracted = extract(term);
    return extracted ? transform(extracted) : undefined;
};

export const getVars = (term: Term): Term[] => {
    const vars: Term[] = [];
    const collect = (t: Term): void => {
        if (t.kind === 'atom' && (t as any).isVariable) {
            vars.push(t);
        } else if (t.kind !== 'atom') {
            (t.args ?? []).forEach(collect);
        }
    };
    collect(term);
    return vars;
};

const termGuard = <K extends Term['kind']>(kind: K) => (term: Term): term is Extract<Term, {
    kind: K
}> => term.kind === kind;

export const inh = termGuard('inheritance');
export const imp = termGuard('implication');
export const conj = termGuard('conjunction');
export const disj = termGuard('disjunction');
export const neg = termGuard('negation');
export const sim = termGuard('similarity');
export const seq = termGuard('sequence');
export const pred = termGuard('predictive');
export const op = termGuard('operation');
export const inst = termGuard('instance');
export const prop = termGuard('property');

export const getArgs = (term: Term): readonly Term[] => term.args ?? [];
export const getArg = (term: Term, index: number): Term | undefined => term.args?.[index];

export const builders = {
    unary: <T>(
        guard: (t: Term) => boolean,
        transform: (t: Term) => T | undefined
    ) => (term: Term): T | undefined =>
        guard(term) ? transform(term) : undefined,

    binary: <T>(
        guard: (t1: Term, t2: Term) => boolean,
        transform: (t1: Term, t2: Term) => T | undefined
    ) => (t1: Term, t2: Term): T | undefined =>
        guard(t1, t2) ? transform(t1, t2) : undefined,

    chain: <T>(
        ...fns: ((t: Term) => T | undefined)[]
    ) => (term: Term): T | undefined =>
        fns.reduce((acc, fn) => acc ?? fn(term), undefined as T | undefined),
} as const;
