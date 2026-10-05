/**
 * Procedural extended NAL rules: decomposition, chaining, operation-to-predictive.
 */
import type { Term } from '../../terms';
import { binaryOf, TermBuilder, termsEqual } from '../../terms';
import type { RuleFn } from '../types.js';

/** `^op(input)` writes as `(a , input)`, so one product unwraps to the bare input. */
const unwrapProduct = (term: Term | undefined): Term | undefined =>
  term?.kind === 'product' && term.args.length === 1 ? term.args[0] : term;

export const proceduralDecomposition: RuleFn = ([seq, op]) => {
  const steps = binaryOf('sequence', seq);
  const call = binaryOf('operation', op);
  const input = call ? unwrapProduct(call[1]) : undefined;
  return steps && call && input
    ? TermBuilder.sequence(steps[0], TermBuilder.operation(call[0], input))
    : undefined;
};

/** `^op1(input1), ^op2(op1) ⊢ op1(input2)` — the chained operation. */
export const proceduralChaining: RuleFn = ([op1, op2]) => {
  const first = binaryOf('operation', op1);
  const second = binaryOf('operation', op2);
  if (!first || !second) return undefined;
  const input1 = unwrapProduct(first[1]);
  const input2 = unwrapProduct(second[1]);
  return input1 && input2 && termsEqual(input1, second[0])
    ? TermBuilder.sequence(first[0], input2)
    : undefined;
};

/** `^op(input), (a &/ input) ⊢ (a =/> input)` — an operation read as a prediction. */
export const operationToPredictive: RuleFn = ([op, seq]) => {
  const call = binaryOf('operation', op);
  const steps = binaryOf('sequence', seq);
  const input = call ? unwrapProduct(call[1]) : undefined;
  return call && steps && input && termsEqual(call[0], steps[0]) && termsEqual(input, steps[1])
    ? TermBuilder.predictive(steps[0], steps[1])
    : undefined;
};
