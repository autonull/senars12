import { TermMap } from '../../terms/term-map.js';
import type { Term } from '../../terms/types.js';

export interface TermMeta {
  lastAccess: number;
  derivationCount: number;
}

const termMetaMap = new TermMap<{ term: Term; meta: TermMeta }>();

export function trackTerm(term: Term): void {
  const existing = termMetaMap.get(term);
  const meta: TermMeta = {
    lastAccess: Date.now(),
    derivationCount: (existing?.meta.derivationCount ?? 0) + 1,
  };
  termMetaMap.set(term, { term, meta });
}

export function untrackTerm(term: Term): void {
  const existing = termMetaMap.get(term);
  if (!existing) return;

  const meta: TermMeta = {
    ...existing.meta,
    derivationCount: existing.meta.derivationCount - 1,
  };

  if (meta.derivationCount <= 0) {
    termMetaMap.delete(term);
  } else {
    termMetaMap.set(term, { term, meta });
  }
}

export function updateAccessTime(term: Term): void {
  const existing = termMetaMap.get(term);
  if (existing) {
    const meta: TermMeta = {
      lastAccess: Date.now(),
      derivationCount: existing.meta.derivationCount,
    };
    termMetaMap.set(term, { term, meta });
  }
}

export function getTermMeta(term: Term): TermMeta | undefined {
  return termMetaMap.get(term)?.meta;
}

export function structuralGC(ttl: number): number {
  const currentTime = Date.now();
  let cleaned = 0;

  const deadTerms: Term[] = [];
  for (const [term, { meta }] of termMetaMap.items()) {
    if (currentTime - meta.lastAccess > ttl && meta.derivationCount === 0) {
      deadTerms.push(term);
    }
  }

  for (const term of deadTerms) {
    termMetaMap.delete(term);
    cleaned++;
  }

  return cleaned;
}
