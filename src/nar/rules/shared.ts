import type {Term} from '../terms';
import {getPredicate, getSubject} from '../terms';
import {createRulePattern, type RuleFn, RuleRegistry, type TruthFn} from './types.js';

export type TermKind = 'inheritance' | 'similarity' | 'implication' | 'equivalence' | 'instance' | 'property' | 'atom' | 'conjunction' | 'disjunction' | 'negation' | 'sequence' | 'predictive' | 'operation';

export interface RuleDefinition {
    readonly id: string;
    readonly leftKind: string;
    readonly rightKind: string;
    readonly apply: RuleFn;
    readonly truthFn: TruthFn;
    readonly priority: number;
}

export const matchKind = (kind: Term['kind']) => (t: Term) => t.kind === kind;
export const matchInh = matchKind('inheritance');
export const matchImp = matchKind('implication');
export const matchConj = matchKind('conjunction');
export const matchDisj = matchKind('disjunction');
export const matchNeg = matchKind('negation');
export const matchSim = matchKind('similarity');
export const matchEq = matchKind('equivalence');
export const matchAtom = matchKind('atom');

export const validInh = (t: Term): boolean => {
    if (!matchInh(t)) return false;
    return !!(getSubject(t) && getPredicate(t));
};

export const validImp = (t: Term): boolean => {
    if (!matchImp(t)) return false;
    const args = t.args ?? [];
    const [a, c] = args;
    return !!(a && c);
};

export const extractInh = (t: Term) => {
    const s = getSubject(t), p = getPredicate(t);
    return {s, p};
};

export const extractInhPair = (inh1: Term, inh2: Term) => {
    const s1 = getSubject(inh1), p1 = getPredicate(inh1);
    const s2 = getSubject(inh2), p2 = getPredicate(inh2);
    if (!s1 || !p1 || !s2 || !p2) return null;
    return {s1, p1, s2, p2};
};

export const matchInhPair = <T>(
    fn: (s1: Term, p1: Term, s2: Term, p2: Term) => T | undefined
) => ([inh1, inh2]: [Term, Term]): T | undefined => {
    const {s1, p1, s2, p2} = extractInhPair(inh1, inh2) ?? {};
    if (!s1 || !p1 || !s2 || !p2) return undefined;
    return fn(s1, p1, s2, p2);
};

export const extractImp = (t: Term) => {
    const args = t.args ?? [];
    const [a, c] = args;
    return {a, c};
};

export const registerRule = (
    id: string,
    left: string,
    right: string,
    fn: RuleFn,
    truthFn: TruthFn,
    priority: number
) =>
    RuleRegistry.register({
        id,
        pattern: createRulePattern(left, right),
        apply: fn,
        sync: true,
        priority,
        truthFn
    });

export type RuleSpec = [string, string, string, RuleFn, TruthFn, number];

export const registerRules = (rules: RuleDefinition[]) =>
    rules.forEach(rule =>
        registerRule(rule.id, rule.leftKind, rule.rightKind, rule.apply, rule.truthFn, rule.priority)
    );

export const rule = (
    id: string,
    leftKind: string,
    rightKind: string,
    apply: RuleFn,
    truthFn: TruthFn,
    priority = 0.8
): RuleDefinition => ({id, leftKind, rightKind, apply, truthFn, priority});