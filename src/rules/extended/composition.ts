import { TermBuilder, termsEqual } from '../../terms';
import { conjunctionIntro } from '../nal/propositional.js';
import { buildBinaryInhRule } from '../impls/rule-builder.js';
import type { RuleFn } from '../types.js';

/** `S--P1, S--P2 ⊢ S--(P1 & P2)` — NAL's `conjunctionIntro`, re-exported. */
export const intersectionComposition: RuleFn = conjunctionIntro;

export const unionComposition: RuleFn = buildBinaryInhRule(([s1, p1], [s2, p2]) =>
  termsEqual(p1, p2)
    ? TermBuilder.inheritance(TermBuilder.disjunction(s1, s2), p1)
    : undefined
);

export const difference: RuleFn = buildBinaryInhRule(([s1, p1], [s2, p2]) =>
  termsEqual(s1, s2)
    ? TermBuilder.inheritance(s1, TermBuilder.conjunction(p1, TermBuilder.negation(p2)))
    : undefined
);
