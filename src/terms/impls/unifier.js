import { Unifier } from '@senars/util/unify';
import { TERM_EQUALITY, termKey } from './accessors';
import { TermBuilder } from './factory';
/**
 * How the generic unifier reads a Narsese term. Reading a term and comparing two
 * are the same question, so the dialect is `TERM_EQUALITY` plus the two
 * operations only unification performs: keying a term, and rebuilding one.
 */
const DIALECT = {
    ...TERM_EQUALITY,
    key: termKey,
    rebuild: (node, kids) => TermBuilder.compound(node.kind, [...kids]),
};
const unifier = new Unifier(DIALECT);
/**
 * Unify two terms, extending `subst`. Returns the extended substitution, or
 * `undefined` when they do not unify — in which case `subst` is unchanged.
 */
export function unify(a, b, subst = new Map(), enableOccursCheck = true) {
    const result = unifier.unify(a, b, subst, {
        occursCheck: enableOccursCheck,
    });
    return result ?? undefined;
}
/** Substitute through `term` until no bound variable remains. Idempotent. */
export const applySubstitution = (term, subst) => unifier.apply(term, subst);
