import type { Term, CompoundTerm } from './types.js';

export type Substitution = Record<string, Term>;

function isVariable(symbol: string): boolean {
    return symbol.startsWith('$');
}

function isCompound(term: Term): term is CompoundTerm {
    return term.kind !== 'atom';
}

export function unify(a: Term, b: Term, subst: Substitution = {}): Substitution | undefined {
    if (a.kind === 'atom' && isVariable(a.symbol)) {
        return subst[a.symbol] === undefined ? { ...subst, [a.symbol]: b } : undefined;
    }
    if (b.kind === 'atom' && isVariable(b.symbol)) {
        return subst[b.symbol] === undefined ? { ...subst, [b.symbol]: a } : undefined;
    }
    if (a.kind === 'atom' && b.kind === 'atom') {
        return a.symbol === b.symbol ? subst : undefined;
    }
    if (!isCompound(a) || !isCompound(b) || a.kind !== b.kind || a.args.length !== b.args.length) {
        return undefined;
    }
    let s: Substitution | undefined = subst;
    for (let i = 0; i < a.args.length; i++) {
        const next = a.args[i];
        const nextB = b.args[i];
        if (!next || !nextB) return undefined;
        s = unify(next, nextB, s ?? {});
        if (!s) return undefined;
    }
    return s ?? subst;
}