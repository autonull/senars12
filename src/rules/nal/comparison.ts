/**
 * Comparison NAL rules present in the core NAL rule set: analogy, comparison,
 * instantiation, exemplification.
 *
 * Every body here reads both premises through {@link buildRolePairRule}, the
 * `inheritance`-or-`similarity` pair. These rules are registered in both
 * `inheritance:similarity` and `inheritance:inheritance` cells, so the extended
 * table gets the same body against a second premise that is an inheritance
 * rather than a similarity — a guard that named one kind would silently stop
 * firing in one of the two cells.
 */
import { TermBuilder, termsEqual } from '../../terms';
import { buildRolePairRule } from '../impls/rule-builder.js';
import type { RuleFn } from '../types.js';

/** `A--B, B<->C ⊢ A--C` — an inheritance meeting a similarity at its predicate. */
export const analogy: RuleFn = buildRolePairRule(([s1, p1], [s2, p2]) =>
  termsEqual(p1, s2) ? TermBuilder.inheritance(s1, p2) : undefined
);

/** `S--P1, S--P2 ⊢ S<->P1` — a shared subject, predicates into a similarity. */
export const comparison: RuleFn = buildRolePairRule(([s1, p1], [s2, p2]) =>
  termsEqual(s1, s2) ? TermBuilder.similarity(p1, p2) : undefined
);

/**
 * `A--B, A<->C ⊢ A--C` — the dual of {@link analogy}, and the conclusion
 * {@link exemplification} also draws.
 */
const sharedPredicateInheritance: RuleFn = buildRolePairRule(([s1, p1], [s2, p2]) =>
  termsEqual(p1, p2) ? TermBuilder.inheritance(s1, s2) : undefined
);

/** `A--B, A<->B ⊢ A--B` — reading a similarity's shared predicate as an inheritance. */
export const instantiation: RuleFn = sharedPredicateInheritance;

export const exemplification: RuleFn = sharedPredicateInheritance;
