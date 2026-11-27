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
import { LruCache } from './lru-cache';
/** Depth cap for the occurs check and variable dereferencing. */
const MAX_DEPTH = 64;
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
export function structuralEqual(ast, a, b, variables = 'strict') {
    if (a === b)
        return true;
    const name = ast.variableName(a);
    if (name !== null)
        return variables === 'wildcard' || name === ast.variableName(b);
    if (ast.variableName(b) !== null)
        return false;
    if (!ast.sameHead(a, b) || !ast.equal(a, b))
        return false;
    const left = ast.children(a);
    const right = ast.children(b);
    if (left.length !== right.length)
        return false;
    for (let i = 0; i < left.length; i++) {
        if (!structuralEqual(ast, left[i], right[i], variables))
            return false;
    }
    return true;
}
const DEFAULTS = { occursCheck: true, memoize: true, memoCapacity: 1000 };
/** Rebuild a memoized result by replaying its delta onto the caller's map. */
const replay = (subst, delta) => {
    const out = new Map(subst);
    if (delta)
        for (const [name, value] of delta)
            out.set(name, value);
    return out;
};
export class Unifier {
    #ast;
    #memoize;
    /** Allocated only when memoization is on — a disabled unifier stays allocation-free. */
    #memo;
    constructor(ast, options = {}) {
        this.#ast = ast;
        this.#memoize = options.memoize ?? DEFAULTS.memoize;
        this.#memo = this.#memoize ? new LruCache(options.memoCapacity ?? DEFAULTS.memoCapacity) : null;
    }
    /**
     * Unify `a` and `b`, extending `subst`. Returns the extended substitution, or
     * `null` when they do not unify — in which case `subst` is untouched.
     */
    unify(a, b, subst = new Map(), options = {}) {
        const occurs = options.occursCheck ?? DEFAULTS.occursCheck;
        const memo = (options.memoize ?? this.#memoize) ? this.#memo : null;
        const key = memo ? this.#key(a, b, subst, occurs) : undefined;
        if (memo && key !== undefined) {
            const hit = memo.get(key);
            if (hit !== undefined)
                return hit === null ? null : replay(subst, hit);
        }
        const work = new Map(subst);
        const added = [];
        const result = this.#descend(a, b, work, added, occurs, 0) ? work : null;
        // Cache the *delta* rather than the result map: a replay is rebuilt onto
        // the caller's own map, so no cached entry is ever aliased to a caller.
        if (memo && key !== undefined)
            memo.set(key, result === null ? null : added);
        return result;
    }
    /** Substitute through `term` until no bound variable remains. Idempotent. */
    apply(term, subst) {
        const name = this.#ast.variableName(term);
        if (name !== null) {
            const bound = subst.get(name);
            if (bound === undefined)
                return term;
            const next = this.apply(bound, subst);
            return this.#ast.equal(next, term) ? term : next;
        }
        const kids = this.#ast.children(term);
        if (kids.length === 0)
            return term;
        let changed = false;
        const applied = kids.map((kid) => {
            const next = this.apply(kid, subst);
            if (next !== kid)
                changed = true;
            return next;
        });
        return changed ? this.#ast.rebuild(term, applied) : term;
    }
    /** Variables appearing anywhere in `term`, in first-occurrence order. */
    variables(term) {
        const found = [];
        const seen = new Set();
        const walk = (node) => {
            const name = this.#ast.variableName(node);
            if (name !== null) {
                if (!seen.has(name)) {
                    seen.add(name);
                    found.push(name);
                }
                return;
            }
            for (const kid of this.#ast.children(node))
                walk(kid);
        };
        walk(term);
        return found;
    }
    clearCache() {
        this.#memo?.clear();
    }
    /** Memo key: both terms plus every *bound value*, never just the names. */
    #key(a, b, subst, occurs) {
        const { key } = this.#ast;
        if (subst.size === 0)
            return `${occurs ? 1 : 0}|${key(a)}|${key(b)}`;
        const bindings = [];
        for (const [name, value] of subst)
            bindings.push(`${name}=${key(value)}`);
        bindings.sort();
        return `${occurs ? 1 : 0}|${key(a)}|${key(b)}|${bindings.join(';')}`;
    }
    /** Follow a variable's bindings to the term they resolve to. */
    #deref(node, work, depth) {
        const name = this.#ast.variableName(node);
        if (name === null || depth >= MAX_DEPTH)
            return node;
        const bound = work.get(name);
        return bound === undefined ? node : this.#deref(bound, work, depth + 1);
    }
    /** True when `variable` occurs in `node`, following existing bindings. */
    #occurs(variable, node, work, depth) {
        if (depth >= MAX_DEPTH)
            return false;
        const name = this.#ast.variableName(node);
        if (name === variable)
            return true;
        if (name !== null) {
            const bound = work.get(name);
            return bound === undefined ? false : this.#occurs(variable, bound, work, depth + 1);
        }
        for (const kid of this.#ast.children(node)) {
            if (this.#occurs(variable, kid, work, depth + 1))
                return true;
        }
        return false;
    }
    #bind(variable, value, work, added, occurs) {
        if (occurs && this.#occurs(variable, value, work, 0))
            return false;
        work.set(variable, value);
        added.push([variable, value]);
        return true;
    }
    #descend(a, b, work, added, occurs, depth) {
        if (depth >= MAX_DEPTH)
            return false;
        const ast = this.#ast;
        const left = this.#deref(a, work, 0);
        const right = this.#deref(b, work, 0);
        if (left === right)
            return true;
        const name = ast.variableName(left);
        const other = ast.variableName(right);
        // The same variable on both sides is already unified — binding it would
        // self-occur and fail the occurs check.
        if (name !== null && name === other)
            return true;
        if (name !== null)
            return this.#bind(name, right, work, added, occurs);
        if (other !== null)
            return this.#bind(other, left, work, added, occurs);
        if (!ast.sameHead(left, right))
            return false;
        const leftKids = ast.children(left);
        const rightKids = ast.children(right);
        // Check arity *before* descending, so a mismatch never half-writes `work`.
        if (leftKids.length !== rightKids.length)
            return false;
        // A node with no children has nothing left to disagree about: its payload is
        // the whole of it. A node with children disagrees or agrees through them.
        if (leftKids.length === 0)
            return ast.equal(left, right);
        for (let i = 0; i < leftKids.length; i++) {
            if (!this.#descend(leftKids[i], rightKids[i], work, added, occurs, depth + 1))
                return false;
        }
        return true;
    }
}
