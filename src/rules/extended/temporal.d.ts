import type { RuleFn } from '../types';
export declare const sequenceIntroduction: RuleFn;
export declare const parallelIntroduction: RuleFn;
/** `(a &/ b) ⊢ (a =/> b)` — a sequence read as its own prediction. */
export declare const predictiveImplication: RuleFn;
/** `(a =/> b), (a &/ b) ⊢ (a --> b)` — a prediction confirmed by its sequence. */
export declare const temporalDeduction: RuleFn;
//# sourceMappingURL=temporal.d.ts.map