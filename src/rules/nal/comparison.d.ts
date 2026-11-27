import type { RuleFn } from '../types';
/** `A--B, B<->C ⊢ A--C` — an inheritance meeting a similarity at its predicate. */
export declare const analogy: RuleFn;
/** `S--P1, S--P2 ⊢ S<->P1` — a shared subject, predicates into a similarity. */
export declare const comparison: RuleFn;
/** `A--B, A<->B ⊢ A--B` — reading a similarity's shared predicate as an inheritance. */
export declare const instantiation: RuleFn;
export declare const exemplification: RuleFn;
//# sourceMappingURL=comparison.d.ts.map