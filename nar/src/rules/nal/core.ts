/**
 * Core NAL rules: syllogistic deduction, induction, abduction, similarity.
 */
import type { Term } from '../../terms';
import { TermBuilder, getPredicate, getSubject, termsEqual } from '../../terms';
import type { RuleFn } from '../types.js';
import { buildBinaryInhRule } from '../rule-builder.js';
import { _deductionLink, _inductionLink, _abductionLink } from '../extractors.js';
import { buildDeduction, buildInduction, buildAbduction } from '../builders.js';

export const deduction: RuleFn = buildBinaryInhRule((l, r) => _deductionLink(l, r), buildDeduction);
export const induction: RuleFn = buildBinaryInhRule((l, r) => _inductionLink(l, r), buildInduction);
export const abduction: RuleFn = buildBinaryInhRule((l, r) => _abductionLink(l, r), buildAbduction);
export const similarity: RuleFn = buildBinaryInhRule(
  (l, r) => {
    const s1 = getSubject(l),
      p1 = getPredicate(l),
      s2 = getSubject(r),
      p2 = getPredicate(r);
    if (!s1 || !p1 || !s2 || !p2) return false;
    return (termsEqual(s1, s2) && termsEqual(p1, p2)) || (termsEqual(s1, p2) && termsEqual(p1, s2));
  },
  (l) => {
    const s = getSubject(l),
      p = getPredicate(l);
    return s && p ? TermBuilder.similarity(s, p) : undefined;
  }
);

export const compose = undefined as unknown as RuleFn;
export const revision = undefined as unknown as RuleFn;
