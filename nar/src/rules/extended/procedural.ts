/**
 * Procedural extended NAL rules: decomposition, chaining, operation-to-predictive.
 */
import type { Term } from '../../terms';
import { TermBuilder, termsEqual } from '../../terms';
import type { RuleFn } from '../types.js';

const unwrapProduct = (term: Term | undefined): Term | undefined =>
  term?.kind === 'product' && term.args.length === 1 ? term.args[0] : term;

export const proceduralDecomposition: RuleFn = ([seq, op]: [Term, Term]): Term | undefined => {
  if (seq.kind !== 'sequence') return undefined;
  if (op.kind !== 'operation') return undefined;
  const [seqA, seqB] = seq.args;
  const [opTerm, inputProd] = op.args;
  const input = unwrapProduct(inputProd);
  if (!seqA || !seqB || !opTerm || !input) return undefined;
  return TermBuilder.sequence(seqA, TermBuilder.operation(opTerm, input));
};

export const proceduralChaining: RuleFn = ([op1, op2]: [Term, Term]): Term | undefined => {
  if (op1.kind !== 'operation' || op2.kind !== 'operation') return undefined;
  const [op1Term, input1Prod] = op1.args;
  const [op2Term, input2Prod] = op2.args;
  const input1 = unwrapProduct(input1Prod);
  const input2 = unwrapProduct(input2Prod);
  if (!op1Term || !input1 || !op2Term || !input2) return undefined;
  if (termsEqual(input1, op2Term)) {
    return TermBuilder.sequence(op1Term, input2);
  }
  return undefined;
};

export const operationToPredictive: RuleFn = ([op, seq]: [Term, Term]): Term | undefined => {
  if (op.kind !== 'operation') return undefined;
  if (seq.kind !== 'sequence') return undefined;
  const [opTerm, inputProd] = op.args;
  const [seqA, seqB] = seq.args;
  const input = unwrapProduct(inputProd);
  if (!opTerm || !input || !seqA || !seqB) return undefined;
  if (termsEqual(opTerm, seqA) && termsEqual(input, seqB)) {
    return TermBuilder.predictive(seqA, seqB);
  }
  return undefined;
};
