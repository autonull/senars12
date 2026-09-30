/**
 * Comparison/extended NAL rules: shared comparison rules plus contraposition and
 * implication deduction (distinct from their NAL core counterparts).
 */
import type { Term } from '../../terms';
import { TermBuilder, termsEqual } from '../../terms';
import { extractInh, sameInhPair } from '../impls/extractors.js';
import { analogy, exemplification } from '../nal/comparison.js';
import { buildBinaryInhRule } from '../impls/rule-builder.js';
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
const sameInhToSimilarity: RuleFn = buildBinaryInhRule(sameInhPair, (inh1, _inh2) => {
  const { s, p } = extractInh(inh1);
  if (!s || !p) return undefined;
  return TermBuilder.similarity(s, p);
});

export const comparison: RuleFn = sameInhToSimilarity;

export const sameness: RuleFn = sameInhToSimilarity;

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
