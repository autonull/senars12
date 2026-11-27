import { TermBuilder, termsEqual } from '../../terms';
import { buildPairRule } from '../impls/rule-builder';
/** `^op(input)` writes as `(a , input)`, so one product unwraps to the bare input. */
const unwrapProduct = (term) => term?.kind === 'product' && term.args.length === 1 ? term.args[0] : term;
export const proceduralDecomposition = buildPairRule(['sequence', 'operation'], ([first], [op, input]) => {
    const unwrapped = unwrapProduct(input);
    return unwrapped
        ? TermBuilder.sequence(first, TermBuilder.operation(op, unwrapped))
        : undefined;
});
/** `^op1(input1), ^op2(op1) ⊢ op1(input2)` — the chained operation. */
export const proceduralChaining = buildPairRule(['operation', 'operation'], ([op1, input1], [op2, input2]) => {
    const first = unwrapProduct(input1);
    const second = unwrapProduct(input2);
    return first && second && termsEqual(first, op2)
        ? TermBuilder.sequence(op1, second)
        : undefined;
});
/** `^op(input), (a &/ input) ⊢ (a =/> input)` — an operation read as a prediction. */
export const operationToPredictive = buildPairRule(['operation', 'sequence'], ([op, input], [a, b]) => {
    const unwrapped = unwrapProduct(input);
    return unwrapped && termsEqual(op, a) && termsEqual(unwrapped, b)
        ? TermBuilder.predictive(a, b)
        : undefined;
});
