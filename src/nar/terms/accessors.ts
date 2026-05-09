import type {AtomicTerm, CompoundTerm, Term} from './types.js';

export const getSubject = (term: Term): Term | undefined =>
    term.kind === 'inheritance' || term.kind === 'similarity' ? term.args[0] : undefined;

export const getPredicate = (term: Term): Term | undefined =>
    term.kind === 'inheritance' || term.kind === 'similarity' ? term.args[1] : undefined;

export const getAntecedent = (term: Term): Term | undefined =>
    term.kind === 'implication' || term.kind === 'equivalence' ? term.args[0] : undefined;

export const getConsequent = (term: Term): Term | undefined =>
    term.kind === 'implication' || term.kind === 'equivalence' ? term.args[1] : undefined;

export const getArgs = (term: Term): readonly Term[] =>
    term.kind === 'atom' ? [] : term.args;

export const isAtom = (term: Term): term is AtomicTerm => term.kind === 'atom';

export const isInheritance = (term: Term): term is CompoundTerm & { kind: 'inheritance' } =>
    term.kind === 'inheritance';

export const isSimilarity = (term: Term): term is CompoundTerm & { kind: 'similarity' } =>
    term.kind === 'similarity';

export const isImplication = (term: Term): term is CompoundTerm & { kind: 'implication' } =>
    term.kind === 'implication';

export const isEquivalence = (term: Term): term is CompoundTerm & { kind: 'equivalence' } =>
    term.kind === 'equivalence';

export const isConjunction = (term: Term): term is CompoundTerm & { kind: 'conjunction' } =>
    term.kind === 'conjunction';

export const isDisjunction = (term: Term): term is CompoundTerm & { kind: 'disjunction' } =>
    term.kind === 'disjunction';

export const isNegation = (term: Term): term is CompoundTerm & { kind: 'negation' } =>
  term.kind === 'negation';

export const isInstance = (term: Term): term is CompoundTerm & { kind: 'instance' } =>
  term.kind === 'instance';

export const isProperty = (term: Term): term is CompoundTerm & { kind: 'property' } =>
  term.kind === 'property';

export const isSequence = (term: Term): term is CompoundTerm & { kind: 'sequence' } =>
  term.kind === 'sequence';

export const isParallel = (term: Term): term is CompoundTerm & { kind: 'parallel' } =>
  term.kind === 'parallel';

export const isPredictive = (term: Term): term is CompoundTerm & { kind: 'predictive' } =>
  term.kind === 'predictive';

export const isRetrospective = (term: Term): term is CompoundTerm & { kind: 'retrospective' } =>
  term.kind === 'retrospective';

export const isOperation = (term: Term): term is CompoundTerm & { kind: 'operation' } =>
  term.kind === 'operation';

export const sameKind = (a: Term, b: Term): boolean => a.kind === b.kind;

const eqAtom = (a: AtomicTerm, b: Term): boolean =>
    b.kind === 'atom' && a.symbol === b.symbol;

const eqCompound = (a: CompoundTerm, b: Term): boolean => {
    if (b.kind !== a.kind) return false;
    if (!('args' in b)) return false;
    if (a.args.length !== b.args.length) return false;
    for (let i = 0; i < a.args.length; i++) {
        if (!termsEqual(a.args[i]!, b.args[i]!)) return false;
    }
    return true;
};

export const termsEqual = (a: Term, b: Term): boolean => {
    if (a === b) return true;
    if (a.hash !== b.hash) return false;
    return a.kind === 'atom' ? eqAtom(a, b) : eqCompound(a, b);
};
