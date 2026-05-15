import type {AtomicTerm, CompoundTerm, OperatorKey, Term} from './types.js';

export const isType = <K extends OperatorKey>(k: K, t: Term): t is CompoundTerm<K> => t.kind === k;

export const isInheritance = (t: Term): t is CompoundTerm<'inheritance'> => isType('inheritance', t);
export const isSimilarity = (t: Term): t is CompoundTerm<'similarity'> => isType('similarity', t);
export const isImplication = (t: Term): t is CompoundTerm<'implication'> => isType('implication', t);
export const isEquivalence = (t: Term): t is CompoundTerm<'equivalence'> => isType('equivalence', t);
export const isConjunction = (t: Term): t is CompoundTerm<'conjunction'> => isType('conjunction', t);
export const isDisjunction = (t: Term): t is CompoundTerm<'disjunction'> => isType('disjunction', t);
export const isNegation = (t: Term): t is CompoundTerm<'negation'> => isType('negation', t);
export const isInstance = (t: Term): t is CompoundTerm<'instance'> => isType('instance', t);
export const isProperty = (t: Term): t is CompoundTerm<'property'> => isType('property', t);
export const isSequence = (t: Term): t is CompoundTerm<'sequence'> => isType('sequence', t);
export const isParallel = (t: Term): t is CompoundTerm<'parallel'> => isType('parallel', t);
export const isPredictive = (t: Term): t is CompoundTerm<'predictive'> => isType('predictive', t);
export const isRetrospective = (t: Term): t is CompoundTerm<'retrospective'> => isType('retrospective', t);
export const isOperation = (t: Term): t is CompoundTerm<'operation'> => isType('operation', t);

const isSubjectPredicate = (t: Term): boolean => t.kind === 'inheritance' || t.kind === 'similarity';
const isAntecedentConsequent = (t: Term): boolean => t.kind === 'implication' || t.kind === 'equivalence';

export const getSubject = (term: Term): Term | undefined => isSubjectPredicate(term) ? term.args?.[0] : undefined;
export const getPredicate = (term: Term): Term | undefined => isSubjectPredicate(term) ? term.args?.[1] : undefined;
export const getAntecedent = (term: Term): Term | undefined => isAntecedentConsequent(term) ? term.args?.[0] : undefined;
export const getConsequent = (term: Term): Term | undefined => isAntecedentConsequent(term) ? term.args?.[1] : undefined;

export const getArgs = (term: Term): readonly Term[] => term.kind === 'atom' ? [] : term.args ?? [];
export const isAtom = (term: Term): term is AtomicTerm => term.kind === 'atom';
export const sameKind = (a: Term, b: Term): boolean => a.kind === b.kind;

export const termsEqual = (a: Term, b: Term): boolean => {
    if (a === b) return true;
    if (a.kind !== b.kind) return false;
    if (a.kind === 'atom') return a.symbol === b.symbol;
    const aArgs = a.args ?? [];
    const bArgs = b.args ?? [];
    if (aArgs.length !== bArgs.length) return false;
    for (let i = 0; i < aArgs.length; i++) {
        if (!termsEqual(aArgs[i]!, bArgs[i]!)) return false;
    }
    return true;
};

export const isCanonical = (term: Term): boolean => Object.isFrozen(term);
export const getCompoundArgs = (term: Term): readonly Term[] | undefined => term.kind === 'atom' ? undefined : term.args;
