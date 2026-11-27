import type { RuleFn } from '../types';
/**
 * `A==>B, A==>B ⊢ A<=>B` — NAL's `equivalenceIntro`, re-exported under the name
 * the extended table declares it by. One derivation, two ids.
 */
export declare const equivalence: RuleFn;
/** `(A --> ?x) ⊢ (A --> ?x)` — the variable-introduction identity, stated once. */
export declare const variableIntroduction: RuleFn;
export declare const decomposition: RuleFn;
//# sourceMappingURL=equivalence.d.ts.map