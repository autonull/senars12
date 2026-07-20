import { TermBuilder, getPredicate, getSubject, termsEqual } from '../../terms';
import { buildBinaryInhRule } from '../rule-builder.js';
import type { RuleFn } from '../types.js';

export const intersectionComposition: RuleFn = buildBinaryInhRule(
  (inh1, inh2) => {
    const sub1 = getSubject(inh1),
      sub2 = getSubject(inh2);
    if (!sub1 || !sub2 || !termsEqual(sub1, sub2)) return false;
    const pred1 = getPredicate(inh1),
      pred2 = getPredicate(inh2);
    return !!(pred1 && pred2);
  },
  (inh1, inh2) => {
    const sub1 = getSubject(inh1);
    const pred1 = getPredicate(inh1),
      pred2 = getPredicate(inh2);
    if (!sub1 || !pred1 || !pred2) return undefined;
    return TermBuilder.inheritance(sub1, TermBuilder.conjunction(pred1, pred2));
  }
);

export const unionComposition: RuleFn = buildBinaryInhRule(
  (inh1, inh2) => {
    const pred1 = getPredicate(inh1),
      pred2 = getPredicate(inh2);
    if (!pred1 || !pred2 || !termsEqual(pred1, pred2)) return false;
    const sub1 = getSubject(inh1),
      sub2 = getSubject(inh2);
    return !!(sub1 && sub2);
  },
  (inh1, inh2) => {
    const sub1 = getSubject(inh1),
      sub2 = getSubject(inh2);
    const pred1 = getPredicate(inh1);
    if (!sub1 || !sub2 || !pred1) return undefined;
    return TermBuilder.inheritance(TermBuilder.disjunction(sub1, sub2), pred1);
  }
);

export const difference: RuleFn = buildBinaryInhRule(
  (inh1, inh2) => {
    const sub1 = getSubject(inh1),
      sub2 = getSubject(inh2);
    if (!sub1 || !sub2 || !termsEqual(sub1, sub2)) return false;
    const pred1 = getPredicate(inh1),
      pred2 = getPredicate(inh2);
    return !!(pred1 && pred2);
  },
  (inh1, inh2) => {
    const sub1 = getSubject(inh1);
    const pred1 = getPredicate(inh1),
      pred2 = getPredicate(inh2);
    if (!sub1 || !pred1 || !pred2) return undefined;
    return TermBuilder.inheritance(
      sub1,
      TermBuilder.conjunction(pred1, TermBuilder.negation(pred2))
    );
  }
);
