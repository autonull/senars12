/**
 * Equivalence extended NAL rules: equivalence, variable introduction, decomposition.
 */
import { binaryOf, TermBuilder, termsEqual } from '../../terms';
import { buildInhRule } from '../impls/rule-builder.js';
import type { RuleFn } from '../types.js';

/**
 * `A==>B, A==>B ⊢ A<=>B` under either argument order.
 *
 * One body for the forward and the backward reading: the two differ only in
 * which end is compared, so `A<=>B` and `B<=>A` were two rules that agreed by
 * transcription.
 */
export const equivalence: RuleFn = ([imp1, imp2]) => {
  const left = binaryOf('implication', imp1);
  const right = binaryOf('implication', imp2);
  if (!left || !right) return undefined;
  const [a1, c1] = left;
  const [a2, c2] = right;
  const same = (termsEqual(a1, a2) && termsEqual(c1, c2)) || (termsEqual(a1, c2) && termsEqual(c1, a2));
  return same ? TermBuilder.equivalence(a1, c1) : undefined;
};

/** `(A --> ?x) ⊢ (A --> ?x)` — the variable-introduction identity, stated once. */
export const variableIntroduction: RuleFn = buildInhRule(([subject, predicate]) =>
  TermBuilder.inheritance(subject, predicate)
);

export const decomposition: RuleFn = ([conj]) =>
  conj.kind === 'conjunction' && conj.args.length >= 2 ? conj.args[0] : undefined;
