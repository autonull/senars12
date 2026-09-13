/**
 * Equivalence extended NAL rules: equivalence, variable introduction, decomposition.
 */
import type { Term } from '../../terms';
import { getPredicate, getSubject, TermBuilder, termsEqual } from '../../terms';
import { ID } from '../extractors.js';
import { buildInhRule } from '../rule-builder.js';
import type { RuleFn } from '../types.js';

export const equivalence: RuleFn = ([imp1, imp2]: [Term, Term]): Term | undefined => {
  if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
  const a1 = imp1.args[0],
    c1 = imp1.args[1];
  const a2 = imp2.args[0],
    c2 = imp2.args[1];
  if (!a1 || !c1 || !a2 || !c2) return undefined;
  const forward = termsEqual(a1, a2) && termsEqual(c1, c2);
  const backward = termsEqual(a1, c2) && termsEqual(c1, a2);
  if (!forward && !backward) return undefined;
  return TermBuilder.equivalence(a1, c1);
};

export const variableIntroduction: RuleFn = buildInhRule(ID, (inh) => {
  const sub = getSubject(inh),
    pred = getPredicate(inh);
  if (!sub || !pred) return undefined;
  return TermBuilder.inheritance(sub, pred);
});

export const decomposition: RuleFn = ([conj]: [Term, Term]): Term | undefined => {
  if (conj.kind !== 'conjunction') return undefined;
  if (conj.args.length < 2) return undefined;
  return conj.args[0] ?? conj;
};
