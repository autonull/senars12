import type { Term, AtomicTerm, CompoundTerm } from './types.js';
import { computeHash, fnv1a } from '../utils/hash.js';

const termCache = new Map<number, Term>();

const cache = <T extends Term>(term: T): T => {
  termCache.set(term.hash, term);
  return term;
};

const TRUE_ATOM = cache(
  Object.freeze({
    kind: 'atom' as const,
    symbol: 'TRUE',
    hash: fnv1a('TRUE'),
    isVariable: false
  } as AtomicTerm)
);

const FALSE_ATOM = cache(
  Object.freeze({
    kind: 'atom' as const,
    symbol: 'FALSE',
    hash: fnv1a('FALSE'),
    isVariable: false
  } as AtomicTerm)
);

export const TermBuilder = {
  atom: (symbol: string): Term => {
    if (symbol === 'TRUE') return TRUE_ATOM;
    if (symbol === 'FALSE') return FALSE_ATOM;
    const hash = fnv1a(symbol);
    const cached = termCache.get(hash);
    if (cached) return cached;
    return cache(
      Object.freeze({
        kind: 'atom' as const,
        symbol,
        hash,
        isVariable: symbol.startsWith('$')
      } as AtomicTerm)
    );
  },

  inheritance: (s: Term | undefined, p: Term | undefined): Term => {
    if (!s || !p) return TermFactory.atom('TRUE');
    const hash = computeHash('inheritance', [s.hash, p.hash]);
    const cached = termCache.get(hash);
    if (cached) return cached;
    return cache(
      Object.freeze({
        kind: 'inheritance' as const,
        args: [s, p],
        hash
      } as CompoundTerm)
    );
  },

  similarity: (s: Term | undefined, p: Term | undefined): Term => {
    if (!s || !p) return TermFactory.atom('TRUE');
    const hash = computeHash('similarity', [s.hash, p.hash]);
    const cached = termCache.get(hash);
    if (cached) return cached;
    return cache(
      Object.freeze({
        kind: 'similarity' as const,
        args: [s, p],
        hash
      } as CompoundTerm)
    );
  },

  conjunction: (...terms: (Term | undefined)[]): Term => {
    const valid = terms.filter((t): t is Term => t !== undefined);
    if (valid.length === 0) return TermFactory.atom('TRUE');
    const sorted = valid.toSorted((a, b) => a.hash - b.hash);
    const hash = computeHash('conjunction', sorted.map(t => t.hash));
    const cached = termCache.get(hash);
    if (cached) return cached;
    return cache(
      Object.freeze({
        kind: 'conjunction' as const,
        args: sorted,
        hash
      } as CompoundTerm)
    );
  },

  disjunction: (...terms: (Term | undefined)[]): Term => {
    const valid = terms.filter((t): t is Term => t !== undefined);
    if (valid.length === 0) return TermFactory.atom('FALSE');
    const sorted = valid.toSorted((a, b) => a.hash - b.hash);
    const hash = computeHash('disjunction', sorted.map(t => t.hash));
    const cached = termCache.get(hash);
    if (cached) return cached;
    return cache(
      Object.freeze({
        kind: 'disjunction' as const,
        args: sorted,
        hash
      } as CompoundTerm)
    );
  },

  negation: (term: Term | undefined): Term => {
    if (!term) return TermFactory.atom('TRUE');
    const hash = computeHash('negation', [term.hash]);
    const cached = termCache.get(hash);
    if (cached) return cached;
    return cache(
      Object.freeze({
        kind: 'negation' as const,
        args: [term],
        hash
      } as CompoundTerm)
    );
  },

  implication: (ant: Term | undefined, cons: Term | undefined): Term => {
    if (!ant || !cons) return TermFactory.atom('TRUE');
    const hash = computeHash('implication', [ant.hash, cons.hash]);
    const cached = termCache.get(hash);
    if (cached) return cached;
    return cache(
      Object.freeze({
        kind: 'implication' as const,
        args: [ant, cons],
        hash
      } as CompoundTerm)
    );
  },

  equivalence: (a: Term | undefined, c: Term | undefined): Term => {
    if (!a || !c) return TermFactory.atom('TRUE');
    const hash = computeHash('equivalence', [a.hash, c.hash]);
    const cached = termCache.get(hash);
    if (cached) return cached;
    return cache(
      Object.freeze({
        kind: 'equivalence' as const,
        args: [a, c],
        hash
      } as CompoundTerm)
    );
  },

  compound: (kind: CompoundTerm['kind'], args: Term[]): Term => {
    const hash = computeHash(kind, args.map(t => t.hash));
    const cached = termCache.get(hash);
    if (cached) return cached;
    return cache(
      Object.freeze({
        kind,
        args,
        hash
      } as CompoundTerm)
    );
  },

  evict: (hash: number): boolean => termCache.delete(hash),
  clear: (): void => termCache.clear(),
  get size(): number {
    return termCache.size;
  }
};

export const freeze = <T extends object>(obj: T): Readonly<T> => Object.freeze(obj);

export const TermFactory = TermBuilder;
