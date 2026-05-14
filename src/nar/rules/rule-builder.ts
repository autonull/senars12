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

export const buildImpRule = (
  extract: (term: Term) => Term | undefined,
  transform: (term: Term) => Term | undefined
): RuleFn => ([term]) => {
  if (term.kind !== 'implication') return undefined;
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

export const inh = (term: Term) => term.kind === 'inheritance' ? term : undefined;
export const imp = (term: Term) => term.kind === 'implication' ? term : undefined;
export const conj = (term: Term) => term.kind === 'conjunction' ? term : undefined;
export const disj = (term: Term) => term.kind === 'disjunction' ? term : undefined;
export const neg = (term: Term) => term.kind === 'negation' ? term : undefined;
export const sim = (term: Term) => term.kind === 'similarity' ? term : undefined;
export const seq = (term: Term) => term.kind === 'sequence' ? term : undefined;
export const pred = (term: Term) => term.kind === 'predictive' ? term : undefined;
export const op = (term: Term) => term.kind === 'operation' ? term : undefined;
export const inst = (term: Term) => term.kind === 'instance' ? term : undefined;
export const prop = (term: Term) => term.kind === 'property' ? term : undefined;

export const getArgs = (term: Term): readonly Term[] => term.args ?? [];
export const getArg = (term: Term, index: number): Term | undefined => term.args?.[index];
