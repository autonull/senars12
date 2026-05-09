import type {Term} from '../terms';

export interface TermMeta {
    lastAccess: number;
    derivationCount: number;
}

const termMetaMap = new Map<number, { term: Term; meta: TermMeta }>();

export function trackTerm(term: Term): void {
    const hash = term.hash;
    const existing = termMetaMap.get(hash);
    const meta: TermMeta = {
        lastAccess: Date.now(),
        derivationCount: (existing?.meta.derivationCount ?? 0) + 1
    };
    termMetaMap.set(hash, {term, meta});
}

export function untrackTerm(term: Term): void {
    const hash = term.hash;
    const existing = termMetaMap.get(hash);
    if (!existing) return;

    const meta: TermMeta = {
        ...existing.meta,
        derivationCount: existing.meta.derivationCount - 1
    };

    if (meta.derivationCount <= 0) {
        termMetaMap.delete(hash);
    } else {
        termMetaMap.set(hash, {term, meta});
    }
}

export function updateAccessTime(term: Term): void {
    const hash = term.hash;
    const existing = termMetaMap.get(hash);
    if (existing) {
        const meta: TermMeta = {
            lastAccess: Date.now(),
            derivationCount: existing.meta.derivationCount
        };
        termMetaMap.set(hash, {term, meta});
    }
}

export function getTermMeta(term: Term): TermMeta | undefined {
    return termMetaMap.get(term.hash)?.meta;
}

export function structuralGC(ttl: number): number {
    const currentTime = Date.now();
    let cleaned = 0;

    const deadHashes: number[] = [];
    for (const [hash, {term: _, meta}] of termMetaMap) {
        if (currentTime - meta.lastAccess > ttl && meta.derivationCount === 0) {
            deadHashes.push(hash);
        }
    }

    for (const hash of deadHashes) {
        termMetaMap.delete(hash);
        cleaned++;
    }

    return cleaned;
}