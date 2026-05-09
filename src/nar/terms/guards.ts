import type {AtomicTerm, CompoundTerm, Term} from './types.js';
import {termsEqual as checkTermsEqual} from './accessors.js';

// Re-export type guards from types.ts
export {
  isVariableSymbol,
  isAtomic,
  isCompound
} from './types.js';

// Re-export accessors
export {
  getSubject,
  getPredicate,
  getAntecedent,
  getConsequent,
  getArgs,
  isAtom,
  isInheritance,
  isSimilarity,
  isImplication,
  isEquivalence,
  isConjunction,
  isDisjunction,
  isNegation,
  termsEqual
} from './accessors.js';

/**
 * Get a stable hash key for a term (for use in Maps/Sets)
 */
export const termHashKey = (term: Term): string => `${term.kind}-${term.hash}`;

/**
 * Check if a term is canonical (constructed via TermFactory)
 * Canonical terms have stable hashes suitable for use as Map keys
 */
export const isCanonical = (term: Term): boolean => {
  return term.hash !== undefined && term.hash !== null;
};

/**
 * Safe argument accessor - returns empty array for atoms
 * This is a convenience wrapper that ensures consistent behavior
 */
export const getArgsSafe = (term: Term): readonly Term[] => {
  return term.kind === 'atom' ? [] : term.args;
};

/**
 * Get term arguments with type narrowing
 * Returns undefined for atoms, args for compounds
 */
export const getCompoundArgs = (term: Term): readonly Term[] | undefined => {
  return term.kind === 'atom' ? undefined : term.args;
};

/**
 * Check if two terms have the same hash (for storage key comparisons)
 * This is a performance optimization - use termsEqual() for logical comparisons
 */
export const sameHash = (a: Term, b: Term): boolean => a.hash === b.hash;

/**
 * Check if two terms are structurally equal
 * Delegates to the more comprehensive termsEqual implementation
 */
export const sameTerm = (a: Term, b: Term): boolean => checkTermsEqual(a, b);

/**
 * Get a unique key for a term (alias for termHashKey for backwards compatibility)
 */
export const termKey = termHashKey;
