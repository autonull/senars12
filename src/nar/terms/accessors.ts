import type { Term, AtomicTerm, CompoundTerm } from './types.js';

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

export const isAtomType = (term: Term): term is AtomicTerm => term.kind === 'atom';
export const isCompoundType = (term: Term): term is CompoundTerm => term.kind !== 'atom';

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

export const matchKinds = (a: Term, b: Term): boolean => a.kind === b.kind;
export const sameHash = (a: Term, b: Term): boolean => a.hash === b.hash;
