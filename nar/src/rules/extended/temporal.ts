/**
 * Temporal extended NAL rules: sequence, parallel, predictive implication, temporal deduction.
 */
import type { Term } from '../../terms';
import { TermBuilder, getPredicate, getSubject, termsEqual } from '../../terms';
import { buildSequenceRule } from '../builders.js';
import type { RuleFn } from '../types.js';

export const sequenceIntroduction: RuleFn = buildSequenceRule(TermBuilder.sequence);
export const parallelIntroduction: RuleFn = buildSequenceRule(TermBuilder.parallel);

export const predictiveImplication: RuleFn = ([seq, inh]: [Term, Term]): Term | undefined => {
  if (seq.kind !== 'sequence') return undefined;
  if (inh.kind !== 'inheritance') return undefined;
  const [seqA, seqB] = seq.args;
  const s = getSubject(inh),
    p = getPredicate(inh);
  if (!seqA || !seqB || !s || !p) return undefined;
  if (termsEqual(seqA, s) && termsEqual(seqB, p)) {
    return TermBuilder.predictive(s, p);
  }
  return undefined;
};

export const temporalDeduction: RuleFn = ([pred, seq]: [Term, Term]): Term | undefined => {
  if (pred.kind !== 'predictive') return undefined;
  if (seq.kind !== 'sequence') return undefined;
  const [predA, predB] = pred.args;
  const [seqA, seqB] = seq.args;
  if (!predA || !predB || !seqA || !seqB) return undefined;
  if (termsEqual(predA, seqA) && termsEqual(predB, seqB)) {
    return TermBuilder.inheritance(seqA, seqB);
  }
  return undefined;
};
