/**
 * Propositional NAL rules: conjunction, disjunction, implication, equivalence, negation.
 */
import type { Term } from '../../terms';
import { binaryOf, TermBuilder, termsEqual, unaryOf } from '../../terms';
import type { RuleFn } from '../types.js';

/** `S--P1, S--P2 ⊢ S--(P1 & P2)` */
export const conjunctionIntro: RuleFn = ([i1, i2]) => {
  const left = binaryOf('inheritance', i1);
  const right = binaryOf('inheritance', i2);
  return left && right && termsEqual(left[0], right[0])
    ? TermBuilder.inheritance(left[0], TermBuilder.conjunction(left[1], right[1]))
    : undefined;
};

export const disjunctionIntro: RuleFn = ([a1, a2]) =>
  a1.kind === 'atom' && a2.kind === 'atom' ? TermBuilder.disjunction(a1, a2) : undefined;

/** `S--P, --P ⊢ S==>P` */
export const implicationIntro: RuleFn = ([inh, neg]) => {
  const ends = binaryOf('inheritance', inh);
  return ends && neg.kind === 'negation' ? TermBuilder.implication(ends[0], ends[1]) : undefined;
};

/** `A==>B, A ⊢ B` */
export const implicationElim: RuleFn = ([imp, atm]) => {
  const ends = binaryOf('implication', imp);
  return ends && atm.kind === 'atom' && termsEqual(ends[0], atm) ? ends[1] : undefined;
};

/** `A==>B, A==>B ⊢ A<=>B` under either argument order. */
export const equivalenceIntro: RuleFn = ([imp1, imp2]) => {
  const left = binaryOf('implication', imp1);
  const right = binaryOf('implication', imp2);
  if (!left || !right) return undefined;
  const same =
    (termsEqual(left[0], right[0]) && termsEqual(left[1], right[1])) ||
    (termsEqual(left[0], right[1]) && termsEqual(left[1], right[0]));
  return same ? TermBuilder.equivalence(left[0], left[1]) : undefined;
};

/** `A<=>B, A ⊢ B` and its symmetric arm. */
export const equivalenceElim: RuleFn = ([eq, atm]) => {
  const ends = binaryOf('equivalence', eq);
  return ends && atm.kind === 'atom' && (termsEqual(ends[0], atm) || termsEqual(ends[1], atm))
    ? ends[1]
    : undefined;
};

/** `A==>A. A==>(--A.) ⊢ --A` — an implication whose ends contradict. */
export const negationIntro: RuleFn = ([imp1, imp2]) => {
  const left = binaryOf('implication', imp1);
  const right = binaryOf('implication', imp2);
  return left && right && termsEqual(left[0], right[0]) && isTrueFalse(left[1], right[1])
    ? TermBuilder.negation(left[0])
    : undefined;
};

/** `--A, --A ⊢ FALSE` */
export const negationElim: RuleFn = ([n1, n2]) => {
  const first = unaryOf('negation', n1);
  const second = unaryOf('negation', n2);
  return first && second && termsEqual(first, second) ? TermBuilder.atom('FALSE') : undefined;
};

/** `(A & B & ...), A ⊢ A` — picking a conjunct out as a term of its own. */
export const destruct: RuleFn = ([conj, atm]) =>
  conj.kind === 'conjunction' && atm.kind === 'atom'
    ? conj.args.find((a) => termsEqual(a, atm))
    : undefined;

const isTrueFalse = (c1: Term, c2: Term): boolean =>
  c1.kind === 'atom' && c2.kind === 'atom' && c1.symbol === 'TRUE' && c2.symbol === 'FALSE';
