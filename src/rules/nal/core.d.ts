import type { RuleFn } from '../types';
/** `S1--P1, P1--P2 ⊢ S1--P2` — the first predicate chains into the second subject. */
export declare const deduction: RuleFn;
/** `S--P, S--P ⊢ S<->P` — the shared pair, in either argument order. */
export declare const similarity: RuleFn;
/** `S1--P1, S2--P1 ⊢ S1--P2` — a shared subject generalises the predicate. */
export declare const induction: RuleFn;
/** `S1--P1, S2--P1 ⊢ S1--S2` — a shared predicate links the two subjects. */
export declare const abduction: RuleFn;
//# sourceMappingURL=core.d.ts.map