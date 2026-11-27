/**
 * Term Unification — first-order unification with occurs check.
 *
 * Implements Robinson's unification algorithm with:
 * - Occurs check for circularity prevention
 * - Substitution composition
 * - Most general unifier (MGU)
 */
import { Term, VariableTerm } from './intern';
/** Substitution mapping variables to terms. */
export type Substitution = Map<VariableTerm, Term>;
/** Unification result. */
export interface UnifyResult {
    /** Whether unification succeeded. */
    success: boolean;
    /** The most general unifier (if success). */
    substitution?: Substitution;
    /** Error message (if failure). */
    error?: string;
    /** The unified term (if success). */
    unified?: Term;
}
/** Unification options. */
export interface UnifyOptions {
    /** Perform occurs check (prevents infinite terms). */
    occursCheck: boolean;
    /** Standardize apart before unifying. */
    standardizeApart: boolean;
    /** Maximum recursion depth. */
    maxDepth: number;
}
/** Default unification options. */
export declare const defaultUnifyOptions: UnifyOptions;
/**
 * Unify two terms.
 * Returns the most general unifier (MGU) if successful.
 */
export declare function unify(a: Term, b: Term, options?: Partial<UnifyOptions>): UnifyResult;
/**
 * Compose two substitutions: subst1 ∘ subst2
 * (apply subst2 then subst1)
 */
export declare function composeSubst(subst1: Substitution, subst2: Substitution): Substitution;
/**
 * Apply substitution to get the unified term.
 */
export declare function applySubstitution(term: Term, subst: Substitution): Term;
/**
 * Find most general unifier for multiple term pairs.
 */
export declare function unifyAll(pairs: Array<[Term, Term]>, options?: Partial<UnifyOptions>): UnifyResult;
/**
 * Anti-unification (generalization): find the least general generalization
 * of two terms. This is the dual of unification.
 */
export interface AntiUnifyResult {
    /** The generalized term. */
    generalization: Term;
    /** Substitution to get first term from generalization. */
    subst1: Substitution;
    /** Substitution to get second term from generalization. */
    subst2: Substitution;
}
export declare function antiUnify(a: Term, b: Term): AntiUnifyResult;
/**
 * Match a pattern against a term (one-way unification).
 * Pattern variables bind to term subterms; term variables are not bound.
 */
export interface MatchResult {
    success: boolean;
    substitution?: Substitution;
    error?: string;
}
export declare function match(pattern: Term, term: Term): MatchResult;
/**
 * Get the variables in a substitution's domain.
 */
export declare function getSubstitutionVariables(subst: Substitution): VariableTerm[];
/**
 * Get the terms in a substitution's range.
 */
export declare function getSubstitutionTerms(subst: Substitution): Term[];
/**
 * Invert a substitution (if it's a bijection on variables).
 */
export declare function invertSubstitution(subst: Substitution): Substitution | null;
//# sourceMappingURL=unify.d.ts.map