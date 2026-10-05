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

/**
 * The NAL rules' short names for the per-kind guards — renamed re-exports, not a
 * second table. These eleven were built by a local `termGuard` narrowing with
 * `Extract<Term, {kind: K}>`; the rules read the short names in a rule pattern,
 * so the spelling stays and the guard is the terms package's.
 */
export {
  isConjunction as conj,
  isDisjunction as disj,
  isImplication as imp,
  isInheritance as inh,
  isNegation as neg,
  isOperation as op,
  isPredictive as pred,
  isSequence as seq,
  isSetExt as setExt,
  isSetInt as setInt,
  isSimilarity as sim,
} from '../../terms';

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
