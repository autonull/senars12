import type { Term } from '../terms/index.js';

export interface TermMeta {
    lastAccess: number;
    derivationCount: number;
}

interface TrackedTerm {
    ref: Term;
    meta: TermMeta;
}

const termRefs = new Set<TrackedTerm>();
const termMetaMap = new Map<Term, TermMeta>();

export function trackTerm(term: Term): void {
    const existing = termMetaMap.get(term);
    const meta: TermMeta = {
        lastAccess: Date.now(),
        derivationCount: (existing?.derivationCount ?? 0) + 1
    };
    termMetaMap.set(term, meta);
    termRefs.add({ ref: term, meta });
}

export function untrackTerm(term: Term): void {
    const existing = termMetaMap.get(term);
    if (!existing) return;

    const meta: TermMeta = {
        ...existing,
        derivationCount: existing.derivationCount - 1
    };

    if (meta.derivationCount <= 0) {
        termMetaMap.delete(term);
        termRefs.delete({ ref: term, meta: existing });
    } else {
        termMetaMap.set(term, meta);
    }
}

export function updateAccessTime(term: Term): void {
    const existing = termMetaMap.get(term);
    const meta: TermMeta = {
        lastAccess: Date.now(),
        derivationCount: existing?.derivationCount ?? 0
    };
    termMetaMap.set(term, meta);
}

export function getTermMeta(term: Term): TermMeta | undefined {
    return termMetaMap.get(term);
}

export function structuralGC(ttl: number): number {
    const currentTime = Date.now();
    let cleaned = 0;

    const deadTerms: Term[] = [];
    for (const [term, meta] of termMetaMap) {
        if (currentTime - meta.lastAccess > ttl && meta.derivationCount === 0) {
            deadTerms.push(term);
        }
    }

    for (const term of deadTerms) {
        const meta = termMetaMap.get(term);
        if (meta) {
            termMetaMap.delete(term);
            termRefs.delete({ ref: term, meta });
            cleaned++;
        }
    }

    return cleaned;
}