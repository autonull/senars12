import { type UnifierSubstitution } from '@senars/util/unify';
import type { Term } from '../types';
/** The unifier's own substitution type — util's, bound to the term dialect. */
export type Substitution = UnifierSubstitution<Term>;
/**
 * Unify two terms, extending `subst`. Returns the extended substitution, or
 * `undefined` when they do not unify — in which case `subst` is unchanged.
 */
export declare function unify(a: Term, b: Term, subst?: Substitution, enableOccursCheck?: boolean): Map<string, Term> | undefined;
/** Substitute through `term` until no bound variable remains. Idempotent. */
export declare const applySubstitution: (term: Term, subst: Substitution) => Term;
//# sourceMappingURL=unifier.d.ts.map