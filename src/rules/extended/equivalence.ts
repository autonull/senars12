/**
 * Equivalence extended NAL rules: equivalence, variable introduction, decomposition.
 */
import { TermBuilder } from '../../terms';
import { equivalenceIntro } from '../nal/propositional.js';
import { buildInhRule } from '../impls/rule-builder.js';
import type { RuleFn } from '../types.js';

/**
 * `A==>B, A==>B ⊢ A<=>B` — NAL's `equivalenceIntro`, re-exported under the name
 * the extended table declares it by. One derivation, two ids.
 */
export const equivalence: RuleFn = equivalenceIntro;

/** `(A --> ?x) ⊢ (A --> ?x)` — the variable-introduction identity, stated once. */
export const variableIntroduction: RuleFn = buildInhRule(([subject, predicate]) =>
  TermBuilder.inheritance(subject, predicate)
);

export const decomposition: RuleFn = ([conj]) =>
  conj.kind === 'conjunction' && conj.args.length >= 2 ? conj.args[0] : undefined;
