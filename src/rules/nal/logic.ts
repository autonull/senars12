/**
 * Logic NAL rules: contrapositive, intersection, union, decomposition.
 */
import { binaryOf, TermBuilder, termsEqual } from '../../terms';
import { foldNary } from '../impls/rule-builder.js';
import type { RuleFn } from '../types.js';

/** `A==>B, --B ⊢ --A==>B` — the first premise supplies the negated subject. */
export const contrapositive: RuleFn = ([imp, inh]) => {
  const ends = binaryOf('implication', imp);
  const pair = binaryOf('inheritance', inh);
  if (!ends || !pair || !termsEqual(ends[0], pair[0])) return undefined;
  return TermBuilder.implication(pair[1], ends[1]);
};

export const intersection: RuleFn = foldNary('conjunction');
export const union: RuleFn = foldNary('disjunction', true);

/** `(A & ...), (B & ...) ⊢ A` — the conjunct both sides share. */
export const decompose: RuleFn = ([c1, c2]) =>
  c1.kind === 'conjunction' && c2.kind === 'conjunction'
    ? c1.args.find((a1) => c2.args.some((a2) => termsEqual(a1, a2)))
    : undefined;
