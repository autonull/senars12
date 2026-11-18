/**
 * Temporal extended NAL rules: sequence, parallel, predictive implication, temporal deduction.
 */
import { TermBuilder, termsEqual } from '../../terms';
import { buildPairRule, buildSequenceRule } from '../impls/rule-builder.js';
import type { RuleFn } from '../types.js';

export const sequenceIntroduction: RuleFn = buildSequenceRule(TermBuilder.sequence);
export const parallelIntroduction: RuleFn = buildSequenceRule(TermBuilder.parallel);

/** `(a &/ b) ⊢ (a =/> b)` — a sequence read as its own prediction. */
export const predictiveImplication: RuleFn = buildPairRule(
  ['sequence', 'inheritance'],
  ([from, to], ends) => (termsEqual(from, ends[0]) && termsEqual(to, ends[1])
    ? TermBuilder.predictive(from, to)
    : undefined)
);

/** `(a =/> b), (a &/ b) ⊢ (a --> b)` — a prediction confirmed by its sequence. */
export const temporalDeduction: RuleFn = buildPairRule(
  ['predictive', 'sequence'],
  ([from, to], steps) => (termsEqual(from, steps[0]) && termsEqual(to, steps[1])
    ? TermBuilder.inheritance(from, to)
    : undefined)
);
