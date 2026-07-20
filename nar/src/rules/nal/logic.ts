/**
 * Logic NAL rules: contrapositive, intersection, union, decomposition.
 */
import type { Term } from '../../terms';
import { TermBuilder, getSubject, termsEqual } from '../../terms';
import { foldNary } from '../builders.js';
import type { RuleFn } from '../types.js';

export const contrapositive: RuleFn = ([imp, inh]: [Term, Term]): Term | undefined => {
  if (imp.kind !== 'implication' || inh.kind !== 'inheritance') return undefined;
  const [ante, cons] = imp.args;
  const sub = getSubject(inh);
  if (!ante || !cons || !sub || !termsEqual(ante, sub)) return undefined;
  const consequent = inh.args[1];
  return consequent ? TermBuilder.implication(consequent, cons) : undefined;
};

export const intersection: RuleFn = foldNary('conjunction', (a1, a2) => termsEqual(a1, a2));
export const union: RuleFn = foldNary('disjunction', (a1, a2) => termsEqual(a1, a2), true);

export const decompose: RuleFn = ([c1, c2]: [Term, Term]): Term | undefined => {
  if (c1.kind !== 'conjunction' || c2.kind !== 'conjunction') return undefined;
  return c1.args.find((a1) => c2.args.some((a2) => termsEqual(a1, a2)));
};
