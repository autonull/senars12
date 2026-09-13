/**
 * Procedural extended NAL rules: decomposition, chaining, operation-to-predictive.
 */
import type { Term } from '../../terms';
import { TermBuilder, termsEqual } from '../../terms';
import type { RuleFn } from '../types.js';

export const proceduralDecomposition: RuleFn = ([seq, op]: [Term, Term]): Term | undefined => {
  if (seq.kind !== 'sequence') return undefined;
  if (op.kind !== 'operation') return undefined;
  const [seqA, seqB] = seq.args;
  const [opTerm, input] = op.args;
  if (!seqA || !seqB || !opTerm || !input) return undefined;
  return TermBuilder.sequence(seqA, TermBuilder.operation(opTerm, input));
};

export const proceduralChaining: RuleFn = ([op1, op2]: [Term, Term]): Term | undefined => {
  if (op1.kind !== 'operation' || op2.kind !== 'operation') return undefined;
  const [op1Term, input1] = op1.args;
  const [op2Term, input2] = op2.args;
  if (!op1Term || !input1 || !op2Term || !input2) return undefined;
  if (termsEqual(input1, op2Term)) {
    return TermBuilder.sequence(op1Term, input2);
  }
  return undefined;
};

export const operationToPredictive: RuleFn = ([op, seq]: [Term, Term]): Term | undefined => {
  if (op.kind !== 'operation') return undefined;
  if (seq.kind !== 'sequence') return undefined;
  const [opTerm, input] = op.args;
  const [seqA, seqB] = seq.args;
  if (!opTerm || !input || !seqA || !seqB) return undefined;
  if (termsEqual(opTerm, seqA) && termsEqual(input, seqB)) {
    return TermBuilder.predictive(seqA, seqB);
  }
  return undefined;
};
