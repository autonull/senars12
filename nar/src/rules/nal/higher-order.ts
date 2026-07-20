import { TermBuilder, termsEqual } from '../../terms';
import { buildHigherOrderRule } from '../builders.js';
import type { RuleFn } from '../types.js';

export const higherOrderDeduction: RuleFn = buildHigherOrderRule(
  (_a1, c1, a2, _c2) => termsEqual(c1, a2),
  (a1, _c1, _a2, c2) => TermBuilder.implication(a1, c2)
);

export const higherOrderAbduction: RuleFn = buildHigherOrderRule(
  (_a1, c1, _a2, c2) => termsEqual(c1, c2),
  (a1, _c1, a2, _c2) => TermBuilder.implication(a1, a2)
);

export const higherOrderInduction: RuleFn = buildHigherOrderRule(
  (a1, _c1, a2, _c2) => termsEqual(a1, a2),
  (_a1, c1, _a2, c2) => TermBuilder.implication(c1, c2)
);
