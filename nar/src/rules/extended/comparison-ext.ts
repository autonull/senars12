/**
 * Comparison/extended NAL rules: shared comparison rules plus contraposition and
 * implication deduction (distinct from their NAL core counterparts).
 */
import type { Term } from '../../terms';
import { TermBuilder, getSubject, getPredicate, termsEqual } from '../../terms';
import type { RuleFn } from '../types.js';
import { buildBinaryInhRule } from '../rule-builder.js';
import { sameInhPair, extractInh } from '../extractors.js';
import { analogy, exemplification } from '../nal/comparison.js';

export { analogy, exemplification };

export const comparison: RuleFn = buildBinaryInhRule(sameInhPair, (inh1, _inh2) => {
  const { s, p } = extractInh(inh1);
  if (!s || !p) return undefined;
  return TermBuilder.similarity(s, p);
});

export const sameness: RuleFn = buildBinaryInhRule(sameInhPair, (inh1, _inh2) => {
  const { s, p } = extractInh(inh1);
  if (!s || !p) return undefined;
  return TermBuilder.similarity(s, p);
});

export const revisionWeak: RuleFn = buildBinaryInhRule(sameInhPair, (inh1, _inh2) => inh1);

export const contrapositionRule: RuleFn = ([imp]: [Term, Term]): Term | undefined => {
  if (imp.kind !== 'implication') return undefined;
  const ante = imp.args[0],
    cons = imp.args[1];
  if (!ante || !cons) return undefined;
  return TermBuilder.implication(TermBuilder.negation(cons), TermBuilder.negation(ante));
};

export const implicationDeduction: RuleFn = ([imp1, imp2]: [Term, Term]): Term | undefined => {
  if (imp1.kind !== 'implication' || imp2.kind !== 'implication') return undefined;
  const cons1 = imp1.args[1];
  const ante2 = imp2.args[0];
  if (!cons1 || !ante2 || !termsEqual(cons1, ante2)) return undefined;
  const ante1 = imp1.args[0];
  const cons2 = imp2.args[1];
  if (!ante1 || !cons2) return undefined;
  return TermBuilder.implication(ante1, cons2);
};
