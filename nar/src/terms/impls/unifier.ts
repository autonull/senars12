import { Unifier, type UnifierDialect, type UnifierSubstitution } from '@senars/util';
import type { Term } from '../types.js';
import { TERM_EQUALITY, termKey } from './accessors.js';
import { TermBuilder } from './factory.js';

/** The unifier's own substitution type — util's, bound to the term dialect. */
export type Substitution = UnifierSubstitution<Term>;

/**
 * How the generic unifier reads a Narsese term. Reading a term and comparing two
 * are the same question, so the dialect is `TERM_EQUALITY` plus the two
 * operations only unification performs: keying a term, and rebuilding one.
 */
const DIALECT: UnifierDialect<Term> = {
  ...TERM_EQUALITY,
  key: termKey,
  rebuild: (node, kids) => TermBuilder.compound(node.kind as never, [...kids]),
};

const unifier = new Unifier(DIALECT);

/**
 * Unify two terms, extending `subst`. Returns the extended substitution, or
 * `undefined` when they do not unify — in which case `subst` is unchanged.
 */
export function unify(
  a: Term,
  b: Term,
  subst: Substitution = new Map(),
  enableOccursCheck = true
): Map<string, Term> | undefined {
  const result = unifier.unify(a, b, subst, {
    occursCheck: enableOccursCheck,
  });
  return result ?? undefined;
}

/** Substitute through `term` until no bound variable remains. Idempotent. */
export const applySubstitution = (term: Term, subst: Substitution): Term =>
  unifier.apply(term, subst);
