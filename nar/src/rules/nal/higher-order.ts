import { TermBuilder, termsEqual } from '../../terms';
import { buildImplicationPairRule } from '../impls/builders.js';
import type { RuleFn } from '../types.js';

/** `A==>B, B==>C ⊢ A==>C` */
export const higherOrderDeduction: RuleFn = buildImplicationPairRule(([a1, c1], [a2, c2]) =>
  termsEqual(c1, a2) ? TermBuilder.implication(a1, c2) : undefined
);

/** `A==>B, C==>B ⊢ A==>C` */
export const higherOrderAbduction: RuleFn = buildImplicationPairRule(([a1, c1], [a2, c2]) =>
  termsEqual(c1, c2) ? TermBuilder.implication(a1, a2) : undefined
);

/** `A==>B, A==>C ⊢ B==>C` */
export const higherOrderInduction: RuleFn = buildImplicationPairRule(([a1, c1], [a2, c2]) =>
  termsEqual(a1, a2) ? TermBuilder.implication(c1, c2) : undefined
);
