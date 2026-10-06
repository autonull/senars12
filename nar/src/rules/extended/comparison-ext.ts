/**
 * Comparison/extended NAL rules: shared comparison rules plus contraposition and
 * implication deduction (distinct from their NAL core counterparts).
 */
import { binaryOf, TermBuilder, termsEqual } from '../../terms';
import { analogy, exemplification } from '../nal/comparison.js';
import { buildBinaryInhRule, buildImplicationPairRule } from '../impls/rule-builder.js';
import type { RuleFn } from '../types.js';

export { analogy, exemplification };

/**
 * `S|--P, S|--P ⊢ S<->P` — one derivation under two names.
 *
 * `comparison` and `sameness` were separate `buildBinaryInhRule` calls with
 * identical bodies, so the two rule ids differed only in truth function
 * (`resemblance` vs `sameness`) and priority. NAL has one such rule; the
 * extended set registered it twice. They are now one function, so the ids
 * cannot drift apart again. Both registrations stay: `nal.sameness` is pinned
 * by `tests/nar/extended-rules.test.ts`, and removing the second derivation is
 * a change to what the engine concludes, not to how it is written.
 */
const sameInhToSimilarity: RuleFn = buildBinaryInhRule(([s1, p1], [s2, p2]) =>
  termsEqual(s1, s2) && termsEqual(p1, p2) ? TermBuilder.similarity(s1, p1) : undefined
);

export const comparison: RuleFn = sameInhToSimilarity;

export const sameness: RuleFn = sameInhToSimilarity;

export const revisionWeak: RuleFn = ([inh1, inh2]) => {
  const left = binaryOf('inheritance', inh1);
  const right = binaryOf('inheritance', inh2);
  return left && right && termsEqual(left[0], right[0]) && termsEqual(left[1], right[1])
    ? inh1
    : undefined;
};

export const contrapositionRule: RuleFn = ([imp]) => {
  const pair = binaryOf('implication', imp);
  return pair ? TermBuilder.implication(TermBuilder.negation(pair[1]), TermBuilder.negation(pair[0])) : undefined;
};

/** `A==>B, B==>C ⊢ A==>C` — chaining two implications at their shared endpoint. */
export const implicationDeduction: RuleFn = buildImplicationPairRule(([a1, c1], [a2, c2]) =>
  termsEqual(c1, a2) ? TermBuilder.implication(a1, c2) : undefined
);
