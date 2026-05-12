import type {Term} from './types.js';

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
 * Check if a term is canonical (constructed via TermFactory)
 * Canonical terms are frozen objects with proper structure
 */
export const isCanonical = (term: Term): boolean => {
  return Object.isFrozen(term);
};

/**
 * Get compound args with type narrowing
 */
export const getCompoundArgs = (term: Term): readonly Term[] | undefined =>
  term.kind === 'atom' ? undefined : term.args;
