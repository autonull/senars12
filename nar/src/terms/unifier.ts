import {termsEqual} from './accessors.js';
import type {Term} from './types.js';
import {isCompound, isVariableSymbol} from './types.js';

export type Substitution = Record<string, Term>;

export interface UnificationResult {
    success: boolean;
    substitution?: Substitution;
    error?: string;
}

const unificationCache = new Map<string, Substitution | undefined>();
const CACHE_MAX_SIZE = 1000;

const occursCheck = (variable: string, term: Term, _subst: Substitution): boolean => {
    if (term.kind === 'atom') {
        return term.symbol === variable;
    }

    for (const arg of term.args ?? []) {
        if (occursCheck(variable, arg, _subst)) return true;
    }

    return false;
};

function termToKey(term: Term): string {
    if (term.kind === 'atom') {
        return `atom:${term.symbol}`;
    }
    return `${term.kind}:${term.args?.map(termToKey).join(',')}`;
}

export function unify(
    a: Term,
    b: Term,
    subst: Substitution = {},
    enableOccursCheck = true
): Substitution | undefined {
    const cacheKey = `${termToKey(a)}-${termToKey(b)}-${Object.keys(subst).sort().join(',')}`;
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
                result = termsEqual(bound, b) ? subst : undefined;
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
                result = termsEqual(bound, a) ? subst : undefined;
            }
        }
    } else if (a.kind === 'atom' && b.kind === 'atom') {
        result = a.symbol === b.symbol ? subst : undefined;
    } else if (
        !isCompound(a) ||
        !isCompound(b) ||
        a.kind !== b.kind ||
        (a.args?.length ?? 0) !== (b.args?.length ?? 0)
    ) {
        result = undefined;
    } else {
        let s: Substitution | undefined = subst;
        const aArgs = a.args ?? [];
        const bArgs = b.args ?? [];
        for (let i = 0; i < aArgs.length; i++) {
            const next = aArgs[i];
            const nextB = bArgs[i];
            if (!next || !nextB) {
                result = undefined;
                break;
            }
            s = unify(next, nextB, s, enableOccursCheck);
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
