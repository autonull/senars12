/**
 * Structural unification over an arbitrary term AST — the single Robinson
 * unifier behind the Narsese unifier and the MeTTa pattern unifier.
 *
 * Both dialects are the same algorithm over a different node type: bind
 * variables, recurse through children, fail on a structural mismatch. The
 * differences are entirely in *how a node is inspected*, so that is all this
 * module parameterizes. What callers get that neither had:
 *
 * - **A length check before descent**, so a failed unification cannot leave
 *   the caller's bindings half-written.
 * - **A default-on occurs check** that chases existing bindings, so `?x = (?x
 *   --> a)` is rejected rather than building a cyclic term.
 * - **Memoization** (toggleable) keyed on the *bound values*, not just the
 *   bound variable names — the only key that is actually correct.
 * - **Full substitution application**, replacing three hand-rolled recursions.
 *
 * Substitutions are plain `Map`s and are treated as immutable: the caller's
 * map is never written to, and a failed unification returns `null` having
 * changed nothing.
 */
/**
 * How to read one term dialect. Implementations are pure and must be cheap —
 * every node visit calls all five.
 */
export interface UnifierDialect<T> {
    /** The variable's name when `node` is a variable, else `null`. */
    variableName: (node: T) => string | null;
    /** Canonical structural key — the single identity for memoization. */
    key: (node: T) => string;
    /**
     * Equality of two nodes' *own* payload — the operator of an expression, the
     * `op` of a grounded atom, the `symbol` of an atom. Never recursive: the
     * children are the walk's business. A deep `equal` here is not a faster path,
     * it is the subtree walked twice, once to answer and once to descend.
     */
    equal: (a: T, b: T) => boolean;
    /** True when both nodes share a head, so their children can be paired. */
    sameHead: (a: T, b: T) => boolean;
    /** Immediate sub-nodes, in binding order. */
    children: (node: T) => readonly T[];
    /** Copy of `node` with `kids` as its children. */
    rebuild: (node: T, kids: readonly T[]) => T;
}
/**
 * The subset of a dialect a structural comparison needs: how to read a node, and
 * nothing else. A comparison never rebuilds and never keys, so it should not have
 * to be handed the two operations it never calls.
 */
export type EqualityDialect<T> = Pick<UnifierDialect<T>, 'variableName' | 'equal' | 'sameHead' | 'children'>;
/** How {@link structuralEqual} treats a variable. */
export type VariablePolicy = 
/** A variable equals a variable of the same name and nothing else. */
'strict'
/** A variable in `a` — the pattern — matches any `b`; a variable in `b` matches none. */
 | 'wildcard';
export interface UnifyOptions {
    /** Reject bindings that would make a term cyclic. Default true. */
    occursCheck?: boolean;
    /** Reuse sub-unification results across calls. Default true. */
    memoize?: boolean;
    /** Memo capacity when `memoize` is on. Default 1000. */
    memoCapacity?: number;
}
export type Substitution<T> = ReadonlyMap<string, T>;
export type UnifierSubstitution<T> = Substitution<T>;
/**
 * Structural equality over a term AST — the same walk {@link Unifier} descends,
 * with the variable question answered up front instead of by binding.
 *
 * The MeTTa and Narsese engines each hand-wrote this descent over their own node
 * kind, and the two MeTTa copies disagreed about variables alone: a space query
 * read `(?x)` as a wildcard, the unifier read it as a named node, so "are these
 * two atoms the same atom" had two answers that happened to live one file apart.
 * The dialect *is* the whole difference between node types, and a variable is a
 * policy rather than a node kind, so both live here — one walk, one place to say
 * what a variable is worth.
 *
 * {@link Unifier}'s own equality test is this same question with the variables
 * already ruled out, which is why it can reach for the dialect's shallow `equal`
 * alone: a childless node is decided by its payload and a childful one by its
 * children.
 */
export declare function structuralEqual<T>(ast: EqualityDialect<T>, a: T, b: T, variables?: VariablePolicy): boolean;
export declare class Unifier<T> {
    #private;
    constructor(ast: UnifierDialect<T>, options?: UnifyOptions);
    /**
     * Unify `a` and `b`, extending `subst`. Returns the extended substitution, or
     * `null` when they do not unify — in which case `subst` is untouched.
     */
    unify(a: T, b: T, subst?: Substitution<T>, options?: UnifyOptions): Map<string, T> | null;
    /** Substitute through `term` until no bound variable remains. Idempotent. */
    apply(term: T, subst: Substitution<T>): T;
    /** Variables appearing anywhere in `term`, in first-occurrence order. */
    variables(term: T): string[];
    clearCache(): void;
}
//# sourceMappingURL=unify.d.ts.map