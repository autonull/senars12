/**
 * Rule builder utilities for deduplicating NAL rule definitions
 */
import type { Term } from '../../terms';
import { isAtomic, walkTerms } from '../../terms';
import type { RuleFn } from '../types.js';

export const buildBinaryInhRule =
  (
    validate: (t1: Term, t2: Term) => boolean,
    transform: (t1: Term, t2: Term) => Term | undefined
  ): RuleFn =>
  ([t1, t2]) => {
    if (t1.kind !== 'inheritance' || t2.kind !== 'inheritance') return undefined;
    if (!validate(t1, t2)) return undefined;
    return transform(t1, t2);
  };

export const buildInhRule =
  (
    extract: (term: Term) => Term | undefined,
    transform: (term: Term) => Term | undefined
  ): RuleFn =>
  ([term]) => {
    if (term.kind !== 'inheritance') return undefined;
    const extracted = extract(term);
    return extracted ? transform(extracted) : undefined;
  };

/**
 * Every variable atom in the term's subtree, in pre-order.
 *
 * The walk is `walkTerms` — the single term traversal — rather than a private
 * recursion, so a new `Term` kind is covered here the moment the accessor
 * covers it instead of silently falling out of this walk.
 */
export const getVars = (term: Term): Term[] => {
  const vars: Term[] = [];
  walkTerms(term, (t) => {
    if (isAtomic(t) && t.isVariable) vars.push(t);
  });
  return vars;
};

const termGuard =
  <K extends Term['kind']>(kind: K) =>
  (
    term: Term
  ): term is Extract<
    Term,
    {
      kind: K;
    }
  > =>
    term.kind === kind;

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

export const getArg = (term: Term, index: number): Term | undefined => term.args?.[index];

export const builders = {
  unary:
    <T>(guard: (t: Term) => boolean, transform: (t: Term) => T | undefined) =>
    (term: Term): T | undefined =>
      guard(term) ? transform(term) : undefined,

  binary:
    <T>(guard: (t1: Term, t2: Term) => boolean, transform: (t1: Term, t2: Term) => T | undefined) =>
    (t1: Term, t2: Term): T | undefined =>
      guard(t1, t2) ? transform(t1, t2) : undefined,

  chain:
    <T>(...fns: ((t: Term) => T | undefined)[]) =>
    (term: Term): T | undefined =>
      fns.reduce((acc, fn) => acc ?? fn(term), undefined as T | undefined),
} as const;
