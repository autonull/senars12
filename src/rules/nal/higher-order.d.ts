import type { RuleFn } from '../types';
/** `A==>B, B==>C ⊢ A==>C` */
export declare const higherOrderDeduction: RuleFn;
/** `A==>B, C==>B ⊢ A==>C` */
export declare const higherOrderAbduction: RuleFn;
/** `A==>B, A==>C ⊢ B==>C` */
export declare const higherOrderInduction: RuleFn;
//# sourceMappingURL=higher-order.d.ts.map