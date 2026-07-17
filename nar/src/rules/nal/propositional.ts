/**
 * Propositional NAL rules: conjunction, disjunction, implication, equivalence, negation.
 */
import type { Term } from '../../terms';
import { TermBuilder, getSubject, getPredicate, termsEqual } from '../../terms';
import type { RuleFn } from '../types.js';

export const conjunctionIntro: RuleFn = ([i1, i2]: [Term, Term]): Term | undefined => {
  if (i1.kind !== 'inheritance' || i2.kind !== 'inheritance') return undefined;
  const s1 = getSubject(i1),
    p1 = getPredicate(i1),
    s2 = getSubject(i2),
    p2 = getPredicate(i2);
  if (!s1 || !p1 || !s2 || !p2 || !termsEqual(s1, s2)) return undefined;
  return TermBuilder.conjunction(p1, p2);
};

export const disjunctionIntro: RuleFn = ([a1, a2]: [Term, Term]): Term | undefined =>
  a1.kind === 'atom' && a2.kind === 'atom' ? TermBuilder.disjunction(a1, a2) : undefined;

export const implicationIntro: RuleFn = ([inh, neg]: [Term, Term]): Term | undefined => {
  if (inh.kind !== 'inheritance' || neg.kind !== 'negation') return undefined;
  const sub = getSubject(inh),
    pred = getPredicate(inh);
  return sub && pred ? TermBuilder.implication(sub, pred) : undefined;
};

export const implicationElim: RuleFn = ([imp, atm]: [Term, Term]): Term | undefined => {
  if (imp.kind !== 'implication' || atm.kind !== 'atom') return undefined;
  const [ante, cons] = imp.args;
  return ante && termsEqual(ante, atm) ? cons : undefined;
};

export const equivalenceIntro: RuleFn = ([imp1, imp2]: [Term, Term]): Term | undefined => {
  if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
  const [a1, c1] = imp1.args,
    [a2, c2] = imp2.args;
  if (!a1 || !c1 || !a2 || !c2) return undefined;
  const match =
    (termsEqual(a1, a2) && termsEqual(c1, c2)) || (termsEqual(a1, c2) && termsEqual(c1, a2));
  return match ? TermBuilder.equivalence(a1, c1) : undefined;
};

export const equivalenceElim: RuleFn = ([eq, atm]: [Term, Term]): Term | undefined => {
  if (eq.kind !== 'equivalence' || atm.kind !== 'atom') return undefined;
  const [a, c] = eq.args;
  if (!a || !c) return undefined;
  return termsEqual(a, atm) || termsEqual(c, atm) ? c : undefined;
};

export const negationIntro: RuleFn = ([imp1, imp2]: [Term, Term]): Term | undefined => {
  if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
  const [a1, c1] = imp1.args,
    [a2, c2] = imp2.args;
  if (!a1 || !c1 || !a2 || !c2) return undefined;
  return termsEqual(a1, a2) &&
    c1.kind === 'atom' &&
    c2.kind === 'atom' &&
    c1.symbol === 'TRUE' &&
    c2.symbol === 'FALSE'
    ? TermBuilder.negation(a1)
    : undefined;
};

export const negationElim: RuleFn = ([n1, n2]: [Term, Term]): Term | undefined => {
  if (n1.kind !== 'negation' || n2.kind !== 'negation') return undefined;
  const [a1] = n1.args,
    [a2] = n2.args;
  return a1 && a2 && termsEqual(a1, a2) ? TermBuilder.atom('FALSE') : undefined;
};

export const destruct: RuleFn = ([conj, atm]: [Term, Term]): Term | undefined =>
  conj.kind === 'conjunction' && atm.kind === 'atom'
    ? conj.args.find((a) => termsEqual(a, atm))
    : undefined;
