/**
 * Operator definitions - standalone to avoid circular dependencies
 */

export const OPERATORS = {
  inheritance: { symbol: '-->', arity: 2, commutative: false, nary: false },
  similarity: { symbol: '<->', arity: 2, commutative: true, nary: false },
  conjunction: { symbol: '&', arity: 0, commutative: true, nary: true },
  disjunction: { symbol: '|', arity: 0, commutative: true, nary: true },
  negation: { symbol: '--', arity: 1, commutative: false, nary: false },
  implication: { symbol: '=>', arity: 2, commutative: false, nary: false },
  equivalence: { symbol: '<=>', arity: 2, commutative: true, nary: false },
  instance: { symbol: '{', arity: 1, commutative: false, nary: false },
  property: { symbol: '[', arity: 1, commutative: false, nary: false },
  sequence: { symbol: ',/', arity: 2, commutative: false, nary: true },
  parallel: { symbol: '||', arity: 2, commutative: true, nary: true },
  predictive: { symbol: '/>', arity: 2, commutative: false, nary: false },
  retrospective: { symbol: '/<', arity: 2, commutative: false, nary: false },
  operation: { symbol: '^', arity: 2, commutative: false, nary: false }
} as const;

export type OperatorKey = keyof typeof OPERATORS;
export type OperatorSymbol = typeof OPERATORS[OperatorKey]['symbol'];

export const COMMUTATIVE_OPS = new Set(
  (Object.entries(OPERATORS) as [OperatorKey, typeof OPERATORS[OperatorKey]][])
    .filter(([, v]) => v.commutative)
    .map(([k]) => k)
);

export const NARY_OPS = new Set(
  (Object.entries(OPERATORS) as [OperatorKey, typeof OPERATORS[OperatorKey]][])
    .filter(([, v]) => v.nary)
    .map(([k]) => k)
);
