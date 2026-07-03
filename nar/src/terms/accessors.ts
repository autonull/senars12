import type { CompoundTerm, OperatorKey, Term } from './types.js';
import { isAtomic } from './types.js';

export const isType = <K extends OperatorKey>(k: K, t: Term): t is CompoundTerm<K> => t.kind === k;

const createTypeGuard =
  <
    K extends
      | 'inheritance'
      | 'similarity'
      | 'implication'
      | 'equivalence'
      | 'conjunction'
      | 'disjunction'
      | 'negation'
      | 'instance'
      | 'property'
      | 'sequence'
      | 'parallel'
      | 'predictive'
      | 'retrospective'
      | 'operation',
  >(
    kind: K
  ) =>
  (t: Term): t is CompoundTerm<K> =>
    isType(kind, t);
export const isInheritance = createTypeGuard('inheritance');
export const isSimilarity = createTypeGuard('similarity');
export const isImplication = createTypeGuard('implication');
export const isEquivalence = createTypeGuard('equivalence');
export const isConjunction = createTypeGuard('conjunction');
export const isDisjunction = createTypeGuard('disjunction');
export const isNegation = createTypeGuard('negation');
export const isInstance = createTypeGuard('instance');
export const isProperty = createTypeGuard('property');
export const isSequence = createTypeGuard('sequence');
export const isParallel = createTypeGuard('parallel');
export const isPredictive = createTypeGuard('predictive');
export const isRetrospective = createTypeGuard('retrospective');
export const isOperation = createTypeGuard('operation');

const isSubjectPredicate = (t: Term): boolean =>
  t.kind === 'inheritance' || t.kind === 'similarity';
const isAntecedentConsequent = (t: Term): boolean =>
  t.kind === 'implication' || t.kind === 'equivalence';

export const getSubject = (term: Term): Term | undefined =>
  isSubjectPredicate(term) ? term.args?.[0] : undefined;
export const getPredicate = (term: Term): Term | undefined =>
  isSubjectPredicate(term) ? term.args?.[1] : undefined;
export const getAntecedent = (term: Term): Term | undefined =>
  isAntecedentConsequent(term) ? term.args?.[0] : undefined;
export const getConsequent = (term: Term): Term | undefined =>
  isAntecedentConsequent(term) ? term.args?.[1] : undefined;

export const getArgs = (term: Term): readonly Term[] =>
  term.kind === 'atom' ? [] : (term.args ?? []);
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

export const visitTerms = (term: Term, fn: (t: Term) => void): void => {
  fn(term);
  if ('args' in term && Array.isArray(term.args)) {
    for (const arg of term.args) {
      visitTerms(arg as Term, fn);
    }
  }
};

export const containsSubterm = (term: Term, target: Term): boolean => {
  if (termsEqual(term, target)) return true;
  const args = 'args' in term && Array.isArray(term.args) ? term.args : [];
  return args.some((a) => containsSubterm(a as Term, target));
};

export const sharesSymbol = (a: Term, b: Term): boolean => {
  const aSyms = collectAtomicSymbols(a);
  const bSyms = collectAtomicSymbols(b);
  for (const s of aSyms) if (bSyms.has(s)) return true;
  return false;
};

export const mentionsSymbol = (term: Term, symbol: string): boolean => {
  if ('symbol' in term && term.symbol === symbol) return true;
  const args = 'args' in term && Array.isArray(term.args) ? term.args : [];
  return args.some((a) => mentionsSymbol(a as Term, symbol));
};

const collectAtomicSymbols = (term: Term, set = new Set<string>()): Set<string> => {
  if (isAtomic(term)) { set.add(term.symbol); return set; }
  const args = 'args' in term && Array.isArray(term.args) ? term.args : [];
  for (const arg of args) collectAtomicSymbols(arg as Term, set);
  return set;
};
