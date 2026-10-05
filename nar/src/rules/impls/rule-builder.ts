/**
 * Rule builder utilities for deduplicating NAL rule definitions
 */
import type { Term } from '../../terms';
import { binaryOf, isAtomic, type TermPair, walkTerms } from '../../terms';
import type { RuleFn, RuleInput } from '../types.js';

/**
 * A binary inheritance rule: one function over the two premises' subject and
 * predicate.
 *
 * The kind guard and the arity check happen once, here, so a body states only
 * what it concludes. They used to be the *other* callback: a `validate`
 * predicate said whether the premises matched and a `transform` said what
 * followed, so both callbacks received still-packed terms and every `transform`
 * opened with the `if (!s || !p) return undefined` its own `validate` had
 * already answered.
 */
export const buildBinaryInhRule =
  (
    derive: (
      left: TermPair,
      right: TermPair,
      inputs?: [RuleInput, RuleInput]
    ) => Term | undefined
  ): RuleFn =>
  ([t1, t2], inputs) => {
    const left = binaryOf('inheritance', t1);
    const right = binaryOf('inheritance', t2);
    return left && right ? derive(left, right, inputs) : undefined;
  };

/** A unary inheritance rule, over the one premise's subject and predicate. */
export const buildInhRule =
  (derive: (pair: TermPair) => Term | undefined): RuleFn =>
  ([term]) => {
    const pair = binaryOf('inheritance', term);
    return pair ? derive(pair) : undefined;
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
