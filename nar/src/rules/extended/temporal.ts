/**
 * Temporal extended NAL rules: sequence, parallel, predictive implication, temporal deduction.
 */
import { binaryOf, TermBuilder, termsEqual } from '../../terms';
import { buildSequenceRule } from '../impls/builders.js';
import type { RuleFn } from '../types.js';

export const sequenceIntroduction: RuleFn = buildSequenceRule(TermBuilder.sequence);
export const parallelIntroduction: RuleFn = buildSequenceRule(TermBuilder.parallel);

/** `(a &/ b) ⊢ (a =/> b)` — a sequence read as its own prediction. */
export const predictiveImplication: RuleFn = ([seq, inh]) => {
  const steps = binaryOf('sequence', seq);
  const ends = binaryOf('inheritance', inh);
  if (!steps || !ends) return undefined;
  const [from, to] = ends;
  return termsEqual(from, steps[0]) && termsEqual(to, steps[1])
    ? TermBuilder.predictive(from, to)
    : undefined;
};

/** `(a =/> b), (a &/ b) ⊢ (a --> b)` — a prediction confirmed by its sequence. */
export const temporalDeduction: RuleFn = ([pred, seq]) => {
  const predicted = binaryOf('predictive', pred);
  const steps = binaryOf('sequence', seq);
  return predicted && steps && termsEqual(predicted[0], steps[0]) && termsEqual(predicted[1], steps[1])
    ? TermBuilder.inheritance(steps[0], steps[1])
    : undefined;
};
