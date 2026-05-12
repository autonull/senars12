import type {AtomicTerm, CompoundTerm, OperatorKey, Term} from './types.js';
import {OPERATORS} from './operators.js';

export const getSubject = (term: Term): Term | undefined =>
    term.kind === 'inheritance' || term.kind === 'similarity' ? term.args![0] : undefined;

export const getPredicate = (term: Term): Term | undefined =>
    term.kind === 'inheritance' || term.kind === 'similarity' ? term.args![1] : undefined;

export const getAntecedent = (term: Term): Term | undefined =>
    term.kind === 'implication' || term.kind === 'equivalence' ? term.args![0] : undefined;

export const getConsequent = (term: Term): Term | undefined =>
    term.kind === 'implication' || term.kind === 'equivalence' ? term.args![1] : undefined;

export const getArgs = (term: Term): readonly Term[] =>
    term.kind === 'atom' ? [] : term.args ?? [];

export const isAtom = (term: Term): term is AtomicTerm => term.kind === 'atom';

type IsGuard<K extends OperatorKey> = (t: Term) => t is CompoundTerm<K> & { kind: K };

export const isType = Object.fromEntries(
    (Object.keys(OPERATORS) as OperatorKey[]).map(key => [
        key,
        ((k: OperatorKey) => (t: Term): t is CompoundTerm<typeof k> => t.kind === k)(key)
    ])
) as Record<OperatorKey, IsGuard<OperatorKey>>;

export const isInheritance = isType.inheritance;
export const isSimilarity = isType.similarity;
export const isImplication = isType.implication;
export const isEquivalence = isType.equivalence;
export const isConjunction = isType.conjunction;
export const isDisjunction = isType.disjunction;
export const isNegation = isType.negation;
export const isInstance = isType.instance;
export const isProperty = isType.property;
export const isSequence = isType.sequence;
export const isParallel = isType.parallel;
export const isPredictive = isType.predictive;
export const isRetrospective = isType.retrospective;
export const isOperation = isType.operation;

export const sameKind = (a: Term, b: Term): boolean => a.kind === b.kind;

const eqAtom = (a: AtomicTerm, b: Term): boolean =>
    b.kind === 'atom' && a.symbol === b.symbol;

const eqCompound = (a: CompoundTerm, b: Term): boolean => {
    if (b.kind !== a.kind) return false;
    const bArgs = b.args ?? [];
    if (a.args.length !== bArgs.length) return false;
    for (let i = 0; i < a.args.length; i++) {
        if (!termsEqual(a.args[i]!, bArgs[i]!)) return false;
    }
    return true;
};

export const termsEqual = (a: Term, b: Term): boolean => {
if (a === b) return true;
if (a.kind !== b.kind) return false;
if (a.kind === 'atom') {
  return a.symbol === b.symbol;
}
const aArgs = a.args ?? [];
const bArgs = b.args ?? [];
if (aArgs.length !== bArgs.length) return false;
for (let i = 0; i < aArgs.length; i++) {
  if (!termsEqual(aArgs[i]!, bArgs[i]!)) return false;
}
return true;
};

export const isCanonical = (term: Term): boolean => {
return Object.isFrozen(term);
};

export const getCompoundArgs = (term: Term): readonly Term[] | undefined =>
term.kind === 'atom' ? undefined : term.args;
