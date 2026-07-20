/**
 * Classical extended NAL rules: modus ponens, modus tollens, conversion.
 */
import type { Term } from '../../terms';
import { TermBuilder, getPredicate, getSubject, termsEqual } from '../../terms';
import type { RuleFn } from '../types.js';

export const modusPonens: RuleFn = ([imp, antecedent]: [Term, Term]): Term | undefined => {
  if (imp.kind !== 'implication' || antecedent.kind !== 'atom') return undefined;
  const [impAnte, impCons] = imp.args;
  return impAnte && impCons && termsEqual(impAnte, antecedent) ? impCons : undefined;
};

export const modusTollens: RuleFn = ([imp, negConsequent]: [Term, Term]): Term | undefined => {
  if (imp.kind !== 'implication' || negConsequent.kind !== 'negation') return undefined;
  const impCons = imp.args[1];
  const negArg = negConsequent.args[0];
  if (!impCons || !negArg || !termsEqual(impCons, negArg)) return undefined;
  const impAnte = imp.args[0];
  return impAnte ? TermBuilder.negation(impAnte) : undefined;
};

export const conversion: RuleFn = ([inh]: [Term, Term]): Term | undefined => {
  if (inh.kind !== 'inheritance') return undefined;
  const s = getSubject(inh),
    p = getPredicate(inh);
  return s && p ? TermBuilder.inheritance(p, s) : undefined;
};
