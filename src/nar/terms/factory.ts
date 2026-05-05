import { fnv1a, computeHash } from './types.js';
import type { Term } from './types.js';

const termCache = new Map<number, Term>();

function getFromCache<T extends Term>(hash: number): T | undefined {
    return termCache.get(hash) as T | undefined;
}

function addToCache<T extends Term>(term: T): T {
    termCache.set(term.hash, term);
    return term;
}

export const TermFactory = {
    atom(symbol: string) {
        const h = fnv1a(symbol);
        const cached = getFromCache(h);
        if (cached) return cached;
        return addToCache({ kind: 'atom' as const, symbol, hash: h });
    },

    inheritance(s: Term, p: Term) {
        const h = computeHash('inheritance', [s.hash, p.hash]);
        const cached = getFromCache(h);
        if (cached) return cached;
        return addToCache({ kind: 'inheritance' as const, args: [s, p], hash: h });
    },

    similarity(s: Term, p: Term) {
        const h = computeHash('similarity', [s.hash, p.hash]);
        const cached = getFromCache(h);
        if (cached) return cached;
        return addToCache({ kind: 'similarity' as const, args: [s, p], hash: h });
    },

    conjunction(...terms: Term[]) {
        if (terms.length === 0) {
            return this.atom('TRUE');
        }
        const sorted = [...terms].sort((a, b) => a.hash - b.hash);
        const h = computeHash('conjunction', sorted.map(t => t.hash));
        const cached = getFromCache(h);
        if (cached) return cached;
        return addToCache({ kind: 'conjunction' as const, args: sorted, hash: h });
    },

    disjunction(...terms: Term[]) {
        if (terms.length === 0) {
            return this.atom('FALSE');
        }
        const sorted = [...terms].sort((a, b) => a.hash - b.hash);
        const h = computeHash('disjunction', sorted.map(t => t.hash));
        const cached = getFromCache(h);
        if (cached) return cached;
        return addToCache({ kind: 'disjunction' as const, args: sorted, hash: h });
    },

    negation(term: Term) {
        const h = computeHash('negation', [term.hash]);
        const cached = getFromCache(h);
        if (cached) return cached;
        return addToCache({ kind: 'negation' as const, args: [term], hash: h });
    },

    implication(antecedent: Term, consequent: Term) {
        const h = computeHash('implication', [antecedent.hash, consequent.hash]);
        const cached = getFromCache(h);
        if (cached) return cached;
        return addToCache({ kind: 'implication' as const, args: [antecedent, consequent], hash: h });
    },

    equivalence(a: Term, c: Term) {
        const h = computeHash('equivalence', [a.hash, c.hash]);
        const cached = getFromCache(h);
        if (cached) return cached;
        return addToCache({ kind: 'equivalence' as const, args: [a, c], hash: h });
    },

    evict(hash: number): boolean {
        return termCache.delete(hash);
    },

    clear(): void {
        termCache.clear();
    },

    get size(): number {
        return termCache.size;
    }
};