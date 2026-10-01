/**
 * Operator definitions - standalone to avoid circular dependencies
 *
 * `symbol` is the **Narsese surface spelling**: what `narsese.peggy` accepts and
 * what `serialize.ts` writes. `scripts/terms-canonical.ts` fails if the grammar's
 * token table and this one disagree, so neither can drift from the other.
 */

export const OPERATORS = {
  inheritance: { symbol: '-->', arity: 2, commutative: false, nary: false },
  similarity: { symbol: '<->', arity: 2, commutative: true, nary: false },
  conjunction: { symbol: '&', arity: 0, commutative: true, nary: true },
  disjunction: { symbol: '|', arity: 0, commutative: true, nary: true },
  negation: { symbol: '--', arity: 1, commutative: false, nary: false },
  implication: { symbol: '==>', arity: 2, commutative: false, nary: false },
  equivalence: { symbol: '<=>', arity: 2, commutative: true, nary: false },
  // Narsese's extensional and intensional sets. `instance` / `property` were a
  // NAL2-rules naming that leaked into the term kinds; `{a}` reads back as a
  // set, and the grammar has always built `setExt` / `setInt`.
  setExt: { symbol: '{', arity: 1, commutative: false, nary: false },
  setInt: { symbol: '[', arity: 1, commutative: false, nary: false },
  sequence: { symbol: '&/', arity: 2, commutative: false, nary: false },
  parallel: { symbol: '&|', arity: 0, commutative: true, nary: true },
  predictive: { symbol: '=/>', arity: 2, commutative: false, nary: false },
  retrospective: { symbol: '=|', arity: 2, commutative: false, nary: false },
  operation: { symbol: '^', arity: 2, commutative: false, nary: false },
  // Products are n-ary but NOT commutative: `docs/java/Op.java:110` builds PROD
  // through the non-commutative constructor, and `(*,a,b)` and `(*,b,a)` are two
  // different products. Declaring them commutative sorted their arguments at
  // construction, so the two interned to one term and `termsEqual` said yes.
  // The comma is the copula — `TermBuilder.tuple` routed the comma list here and
  // built a conjunction instead, so no product had any text syntax at all.
  product: { symbol: ',', arity: 0, commutative: false, nary: true },
} as const;

export type OperatorKey = keyof typeof OPERATORS;
export type OperatorSymbol = (typeof OPERATORS)[OperatorKey]['symbol'];

export const COMMUTATIVE_OPS = new Set<OperatorKey>();
export const NARY_OPS = new Set<OperatorKey>();
for (const [k, v] of Object.entries(OPERATORS) as [
  OperatorKey,
  (typeof OPERATORS)[OperatorKey],
][]) {
  v.commutative && COMMUTATIVE_OPS.add(k);
  v.nary && NARY_OPS.add(k);
}
