/**
 * Term Unification — first-order unification with occurs check.
 *
 * Implements Robinson's unification algorithm with:
 * - Occurs check for circularity prevention
 * - Substitution composition
 * - Most general unifier (MGU)
 */
import { TermOp, termInterner, substitute, standardizeApart } from './intern';
/** Default unification options. */
export const defaultUnifyOptions = {
    occursCheck: true,
    standardizeApart: true,
    maxDepth: 1000,
};
/**
 * Unify two terms.
 * Returns the most general unifier (MGU) if successful.
 */
export function unify(a, b, options = {}) {
    const opts = { ...defaultUnifyOptions, ...options };
    let depth = 0;
    // Standardize apart to avoid variable capture
    let termA = a;
    let termB = b;
    if (opts.standardizeApart) {
        termA = standardizeApart(a);
        termB = standardizeApart(b);
    }
    const substitution = new Map();
    const result = unifyTerms(termA, termB, substitution, opts, depth);
    if (!result.success)
        return result;
    // Apply substitution to get unified term
    const unified = substitute(termA, substitution);
    return {
        success: true,
        substitution,
        unified,
    };
}
/**
 * Core unification algorithm.
 */
function unifyTerms(a, b, subst, options, depth) {
    if (depth > options.maxDepth) {
        return { success: false, error: 'Maximum unification depth exceeded' };
    }
    // Apply current substitution
    a = applySubst(a, subst);
    b = applySubst(b, subst);
    // Identical terms
    if (a === b)
        return { success: true };
    // Variable cases
    if (a.op === TermOp.VARIABLE)
        return unifyVariable(a, b, subst, options, depth);
    if (b.op === TermOp.VARIABLE)
        return unifyVariable(b, a, subst, options, depth);
    // Both constants
    if (a.op === TermOp.CONSTANT && b.op === TermOp.CONSTANT) {
        return a.value === b.value
            ? { success: true }
            : { success: false, error: `Constants differ: ${a.value} !== ${b.value}` };
    }
    // Both compounds
    if (a.op !== TermOp.CONSTANT && b.op !== TermOp.CONSTANT) {
        const ca = a;
        const cb = b;
        if (ca.op !== cb.op) {
            return { success: false, error: `Operators differ: ${ca.op} !== ${cb.op}` };
        }
        if (ca.arity !== cb.arity) {
            return { success: false, error: `Arity differs: ${ca.arity} !== ${cb.arity}` };
        }
        // Unify arguments pairwise
        for (let i = 0; i < ca.arity; i++) {
            const result = unifyTerms(ca.args[i], cb.args[i], subst, options, depth + 1);
            if (!result.success)
                return result;
        }
        return { success: true };
    }
    // One constant, one compound
    return { success: false, error: 'Cannot unify constant with compound' };
}
/**
 * Unify a variable with a term.
 */
function unifyVariable(v, term, subst, options, depth) {
    // Already substituted?
    const existing = subst.get(v);
    if (existing) {
        return unifyTerms(existing, term, subst, options, depth);
    }
    // Occurs check
    if (options.occursCheck && occursCheck(v, term, subst)) {
        return { success: false, error: `Occurs check failed: ${v.name} occurs in ${termInterner.format(term)}` };
    }
    // Bind variable
    subst.set(v, term);
    return { success: true };
}
/**
 * Check if a variable occurs in a term (with substitution applied).
 */
function occursCheck(v, term, subst) {
    const visited = new Set();
    const check = (t) => {
        if (visited.has(t))
            return false;
        visited.add(t);
        t = applySubst(t, subst);
        if (t === v)
            return true;
        if (t.op === TermOp.VARIABLE)
            return false;
        if (t.op === TermOp.CONSTANT)
            return false;
        const ct = t;
        for (const arg of ct.args) {
            if (check(arg))
                return true;
        }
        return false;
    };
    return check(term);
}
/**
 * Apply substitution to a term.
 */
function applySubst(term, subst) {
    return substitute(term, subst);
}
/**
 * Compose two substitutions: subst1 ∘ subst2
 * (apply subst2 then subst1)
 */
export function composeSubst(subst1, subst2) {
    const result = new Map();
    // Apply subst1 to subst2's range
    for (const [v, t] of subst2) {
        result.set(v, applySubst(t, subst1));
    }
    // Add subst1's bindings (overriding)
    for (const [v, t] of subst1) {
        result.set(v, t);
    }
    return result;
}
/**
 * Apply substitution to get the unified term.
 */
export function applySubstitution(term, subst) {
    return applySubst(term, subst);
}
/**
 * Check if two terms are unifiable (without computing MGU).
 */
function isUnifiable(a, b, options) {
    return unify(a, b, options).success;
}
/**
 * Find most general unifier for multiple term pairs.
 */
export function unifyAll(pairs, options = {}) {
    let combinedSubst = new Map();
    for (const [a, b] of pairs) {
        // Apply current substitution to both terms
        const aSubst = applySubst(a, combinedSubst);
        const bSubst = applySubst(b, combinedSubst);
        const result = unify(aSubst, bSubst, { ...options, standardizeApart: false });
        if (!result.success)
            return result;
        // Compose substitutions
        combinedSubst = composeSubst(result.substitution, combinedSubst);
    }
    // Apply combined substitution to first term of first pair
    const unified = applySubst(pairs[0][0], combinedSubst);
    return { success: true, substitution: combinedSubst, unified };
}
export function antiUnify(a, b) {
    const subst1 = new Map();
    const subst2 = new Map();
    let varCounter = 0;
    const gen = antiUnifyTerms(a, b, subst1, subst2, varCounter);
    return { generalization: gen.term, subst1: gen.subst1, subst2: gen.subst2 };
}
function antiUnifyTerms(a, b, subst1, subst2, varCounter) {
    // Apply current substitutions
    a = applySubst(a, subst1);
    b = applySubst(b, subst2);
    // Identical
    if (a === b) {
        return { term: a, subst1, subst2, varCounter };
    }
    // Both variables
    if (a.op === TermOp.VARIABLE && b.op === TermOp.VARIABLE) {
        const v = termInterner.variable(`_${varCounter++}`);
        subst1.set(a, v);
        subst2.set(b, v);
        return { term: v, subst1, subst2, varCounter };
    }
    // One variable
    if (a.op === TermOp.VARIABLE) {
        const v = termInterner.variable(`_${varCounter++}`);
        subst1.set(a, v);
        subst2.set(v, b);
        return { term: v, subst1, subst2, varCounter };
    }
    if (b.op === TermOp.VARIABLE) {
        const v = termInterner.variable(`_${varCounter++}`);
        subst2.set(b, v);
        subst1.set(v, a);
        return { term: v, subst1, subst2, varCounter };
    }
    // Both constants
    if (a.op === TermOp.CONSTANT && b.op === TermOp.CONSTANT) {
        if (a.value === b.value) {
            return { term: a, subst1, subst2, varCounter };
        }
        // Different constants -> new variable
        const v = termInterner.variable(`_${varCounter++}`);
        subst1.set(v, a);
        subst2.set(v, b);
        return { term: v, subst1, subst2, varCounter };
    }
    // Both compounds
    if (a.op !== TermOp.CONSTANT && b.op !== TermOp.CONSTANT) {
        const ca = a;
        const cb = b;
        if (ca.op === cb.op && ca.arity === cb.arity) {
            let result = { term: ca, subst1, subst2, varCounter };
            const newArgs = [];
            for (let i = 0; i < ca.arity; i++) {
                const argResult = antiUnifyTerms(ca.args[i], cb.args[i], result.subst1, result.subst2, result.varCounter);
                newArgs.push(argResult.term);
                result = argResult;
            }
            return {
                term: termInterner.compound(ca.op, ...newArgs),
                subst1: result.subst1,
                subst2: result.subst2,
                varCounter: result.varCounter,
            };
        }
    }
    // Different structure -> new variable
    const v = termInterner.variable(`_${varCounter++}`);
    subst1.set(v, a);
    subst2.set(v, b);
    return { term: v, subst1, subst2, varCounter };
}
export function match(pattern, term) {
    const subst = new Map();
    const result = matchTerms(pattern, term, subst);
    if (!result.success)
        return result;
    return { success: true, substitution: subst };
}
function matchTerms(pattern, term, subst) {
    pattern = applySubst(pattern, subst);
    if (pattern === term)
        return { success: true };
    if (pattern.op === TermOp.VARIABLE) {
        const v = pattern;
        const existing = subst.get(v);
        if (existing) {
            return matchTerms(existing, term, subst);
        }
        subst.set(v, term);
        return { success: true };
    }
    if (pattern.op === TermOp.CONSTANT && term.op === TermOp.CONSTANT) {
        return pattern.value === term.value
            ? { success: true }
            : { success: false, error: 'Constant mismatch' };
    }
    if (pattern.op !== TermOp.CONSTANT && term.op !== TermOp.CONSTANT) {
        const cp = pattern;
        const ct = term;
        if (cp.op !== ct.op || cp.arity !== ct.arity) {
            return { success: false, error: 'Structure mismatch' };
        }
        for (let i = 0; i < cp.arity; i++) {
            const result = matchTerms(cp.args[i], ct.args[i], subst);
            if (!result.success)
                return result;
        }
        return { success: true };
    }
    return { success: false, error: 'Type mismatch' };
}
/**
 * Get the variables in a substitution's domain.
 */
export function getSubstitutionVariables(subst) {
    return Array.from(subst.keys());
}
/**
 * Get the terms in a substitution's range.
 */
export function getSubstitutionTerms(subst) {
    return Array.from(subst.values());
}
/**
 * Invert a substitution (if it's a bijection on variables).
 */
export function invertSubstitution(subst) {
    const inverse = new Map();
    for (const [v, t] of subst) {
        if (t.op !== TermOp.VARIABLE)
            return null;
        const tv = t;
        if (inverse.has(tv))
            return null; // Not injective
        inverse.set(tv, v);
    }
    return inverse;
}
