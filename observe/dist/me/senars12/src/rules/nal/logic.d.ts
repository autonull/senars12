import type { RuleFn } from '../types';
/** `A==>B, --B ⊢ --A==>B` — the first premise supplies the negated subject. */
export declare const contrapositive: RuleFn;
export declare const intersection: RuleFn;
export declare const union: RuleFn;
/** `(A & ...), (B & ...) ⊢ A` — the conjunct both sides share. */
export declare const decompose: RuleFn;
//# sourceMappingURL=logic.d.ts.map