import type { Term } from '../../terms';
import { getPredicate, getSubject, TermBuilder, termsEqual } from '../../terms';
import { buildBinaryInhRule } from '../impls/rule-builder.js';
import type { RuleFn } from '../types.js';

/**
 * Both operands are about the same subject and both name a predicate.
 *
 * Every set composition needs this before it can state its own conclusion, so it
 * is a predicate rather than the same four guards copied into each matcher — a
 * matcher that forgets the predicate check would build a conjunction of `undefined`.
 */
const sameSubjectWithPredicates = (inh1: Term, inh2: Term): boolean => {
  const sub1 = getSubject(inh1);
  const sub2 = getSubject(inh2);
  if (!sub1 || !sub2 || !termsEqual(sub1, sub2)) return false;
  return !!(getPredicate(inh1) && getPredicate(inh2));
};

/** The dual: both operands name the same predicate and each has a subject. */
const samePredicateWithSubjects = (inh1: Term, inh2: Term): boolean => {
  const pred1 = getPredicate(inh1);
  const pred2 = getPredicate(inh2);
  if (!pred1 || !pred2 || !termsEqual(pred1, pred2)) return false;
  return !!(getSubject(inh1) && getSubject(inh2));
};

export const intersectionComposition: RuleFn = buildBinaryInhRule(
  sameSubjectWithPredicates,
  (inh1, inh2) => {
    const sub1 = getSubject(inh1);
    const pred1 = getPredicate(inh1),
      pred2 = getPredicate(inh2);
    if (!sub1 || !pred1 || !pred2) return undefined;
    return TermBuilder.inheritance(sub1, TermBuilder.conjunction(pred1, pred2));
  }
);

export const unionComposition: RuleFn = buildBinaryInhRule(
  samePredicateWithSubjects,
  (inh1, inh2) => {
    const sub1 = getSubject(inh1),
      sub2 = getSubject(inh2);
    const pred1 = getPredicate(inh1);
    if (!sub1 || !sub2 || !pred1) return undefined;
    return TermBuilder.inheritance(TermBuilder.disjunction(sub1, sub2), pred1);
  }
);

export const difference: RuleFn = buildBinaryInhRule(sameSubjectWithPredicates, (inh1, inh2) => {
  const sub1 = getSubject(inh1);
  const pred1 = getPredicate(inh1),
    pred2 = getPredicate(inh2);
  if (!sub1 || !pred1 || !pred2) return undefined;
  return TermBuilder.inheritance(sub1, TermBuilder.conjunction(pred1, TermBuilder.negation(pred2)));
});
