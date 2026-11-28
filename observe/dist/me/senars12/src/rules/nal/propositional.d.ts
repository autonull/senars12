import type { RuleFn } from '../types';
/** `S--P1, S--P2 ⊢ S--(P1 & P2)` */
export declare const conjunctionIntro: RuleFn;
export declare const disjunctionIntro: RuleFn;
/** `S--P, --P ⊢ S==>P` */
export declare const implicationIntro: RuleFn;
/** `A==>B, A ⊢ B` */
export declare const implicationElim: RuleFn;
/** `A==>B, A==>B ⊢ A<=>B` under either argument order. */
export declare const equivalenceIntro: RuleFn;
/** `A<=>B, A ⊢ B` and its symmetric arm. */
export declare const equivalenceElim: RuleFn;
/** `A==>A. A==>(--A.) ⊢ --A` — an implication whose ends contradict. */
export declare const negationIntro: RuleFn;
/** `--A, --A ⊢ FALSE` */
export declare const negationElim: RuleFn;
/** `(A & B & ...), A ⊢ A` — picking a conjunct out as a term of its own. */
export declare const destruct: RuleFn;
//# sourceMappingURL=propositional.d.ts.map