import type { RuleFn } from '../types';
/**
 * `A==>B, A ⊢ B` — NAL's `implicationElim`, under the name classical logic
 * knows it by. One body, two rule ids, the way `comparison-ext.ts` already
 * re-exports the NAL `analogy`.
 */
export declare const modusPonens: RuleFn;
/** `A==>B, --B ⊢ --A` */
export declare const modusTollens: RuleFn;
/** `A|B, --A ⊢ B` */
export declare const disjunctiveSyllogism: RuleFn;
/** `S-->P ⊢ P-->S` — the only rule that inverts an inheritance's own arguments. */
export declare const conversion: RuleFn;
//# sourceMappingURL=classical.d.ts.map