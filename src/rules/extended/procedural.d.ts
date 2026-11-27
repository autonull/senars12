import type { RuleFn } from '../types';
export declare const proceduralDecomposition: RuleFn;
/** `^op1(input1), ^op2(op1) ⊢ op1(input2)` — the chained operation. */
export declare const proceduralChaining: RuleFn;
/** `^op(input), (a &/ input) ⊢ (a =/> input)` — an operation read as a prediction. */
export declare const operationToPredictive: RuleFn;
//# sourceMappingURL=procedural.d.ts.map