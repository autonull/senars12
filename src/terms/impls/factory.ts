import type { AtomicTerm, OperatorKey, Term } from '../types.js';
import { canonicalTerm } from '../reduce.js';
import { containsSubterm } from './accessors.js';
import {
  atomOf,
  clearTerms,
  compoundOf,
  evictTerm,
  rawCompoundCtors,
  termCacheSize,
} from './intern.js';

/**
 * Every public construction path canonicalises before it keys, so interning,
 * `termsEqual` and memory dedup agree by construction rather than by which
 * producer remembered to normalise (TODO29.a §5.12).
 */
const createCompound = (kind: OperatorKey, args: Term[]): Term =>
  canonicalTerm(compoundOf(kind, args));

const negation = (term: Term): Term => createCompound('negation', [term]);

const canonicalCtors = {} as Record<OperatorKey, (...args: Term[]) => Term>;
for (const kind of Object.keys(rawCompoundCtors) as OperatorKey[]) {
  canonicalCtors[kind] = (...args: Term[]) => createCompound(kind, args);
}

export const TermBuilder = {
  atom: atomOf,
  ...canonicalCtors,

  compound: (kind: OperatorKey, args: Term[]): Term => createCompound(kind, args),

  // Peggy parser compatibility aliases
  create: (kind: string, args: Term[]): Term => createCompound(kind as OperatorKey, args),
  setExt: (...components: Term[]): Term => createCompound('setExt', components),
  setInt: (...components: Term[]): Term => createCompound('setInt', components),
  inheritance: (subj: Term, pred: Term): Term | undefined => {
    if (containsSubterm(subj, pred) || containsSubterm(pred, subj)) {
      return undefined;
    }
    return createCompound('inheritance', [subj, pred]);
  },
  negation,
  delta: negation, // Narsese's delta is a negation

  evict: evictTerm,
  clear: clearTerms,
  get size(): number {
    return termCacheSize();
  },
};

export const TermFactory = TermBuilder;
export const atom = TermBuilder.atom;
