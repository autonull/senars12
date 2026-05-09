import type {CompoundTerm, Term} from './types.js';
import {isVariableSymbol} from './types.js';

export type Substitution = Record<string, Term>;

export interface UnificationResult {
    success: boolean;
    substitution?: Substitution;
    error?: string;
}

const unificationCache = new Map<string, Substitution | undefined>();
const CACHE_MAX_SIZE = 1000;

const isCompound = (term: Term): term is CompoundTerm => term.kind !== 'atom';

const occursCheck = (variable: string, term: Term, subst: Substitution): boolean => {
    if (term.kind === 'atom') {
        if (term.symbol === variable) return true;
        return false;
    }

    for (const arg of term.args) {
        if (occursCheck(variable, arg, subst)) return true;
    }

    return false;
};

const _applySubstitution = (term: Term, subst: Substitution): Term => {
    if (term.kind === 'atom') {
        if (term.symbol in subst) {
            return subst[term.symbol]!;
        }
        return term;
    }

    const newArgs = term.args.map(arg => applySubstitution(arg, subst));
    return {...term, args: newArgs} as Term;
};

export function unify(a: Term, b: Term, subst: Substitution = {}, enableOccursCheck = true): Substitution | undefined {
    const cacheKey = `${a.hash}-${b.hash}-${Object.keys(subst).sort().join(',')}`;
    const cached = unificationCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    let result: Substitution | undefined;

    if (a.kind === 'atom' && isVariableSymbol(a.symbol)) {
        if (enableOccursCheck && occursCheck(a.symbol, b, subst)) {
            result = undefined;
        } else {
            const bound = subst[a.symbol];
            if (!bound) {
                result = {...subst, [a.symbol]: b};
            } else {
                result = bound.hash === b.hash ? subst : undefined;
            }
        }
    } else if (b.kind === 'atom' && isVariableSymbol(b.symbol)) {
        if (enableOccursCheck && occursCheck(b.symbol, a, subst)) {
            result = undefined;
        } else {
            const bound = subst[b.symbol];
            if (!bound) {
                result = {...subst, [b.symbol]: a};
            } else {
                result = bound.hash === a.hash ? subst : undefined;
            }
        }
    } else if (a.kind === 'atom' && b.kind === 'atom') {
        result = a.symbol === b.symbol ? subst : undefined;
    } else if (!isCompound(a) || !isCompound(b) || a.kind !== b.kind || a.args.length !== b.args.length) {
        result = undefined;
    } else {
        let s: Substitution | undefined = subst;
        for (let i = 0; i < a.args.length; i++) {
            const next = a.args[i];
            const nextB = b.args[i];
            if (!next || !nextB) {
                result = undefined;
                break;
            }
            s = unify(next, nextB, s ?? {}, enableOccursCheck);
            if (!s) {
                result = undefined;
                break;
            }
        }
        result = s ?? subst;
    }

    if (unificationCache.size < CACHE_MAX_SIZE) {
        unificationCache.set(cacheKey, result);
    }

    return result;
}

export function unifyMultiple(terms: Term[], initialSubst: Substitution = {}): Substitution | undefined {
    if (terms.length === 0) return initialSubst;
    if (terms.length === 1) return initialSubst;

    let subst = initialSubst;
    const first = terms[0]!;

    for (let i = 1; i < terms.length; i++) {
        const second = terms[i]!;
        const result = unify(first, second, subst);
        if (!result) return undefined;
        subst = result;
    }

    return subst;
}

export function composeBindings(s1: Substitution, s2: Substitution): Substitution | undefined {
    const result = {...s1};

    for (const [varName, term] of Object.entries(s2)) {
        if (varName in s1) {
            const existing = s1[varName]!;
            if (existing.hash !== term.hash) {
                const unified = unify(existing, term, s1);
                if (!unified) return undefined;
                result[varName] = unified[varName] || term;
            }
        } else {
            result[varName] = term;
        }
    }

    return result;
}

export function clearUnificationCache(): void {
    unificationCache.clear();
}

export function getUnificationCacheSize(): number {
    return unificationCache.size;
}
