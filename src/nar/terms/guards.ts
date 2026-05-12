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
 * Get compound args with type narrowing
 */
export const getCompoundArgs = (term: Term): readonly Term[] | undefined =>
    term.kind === 'atom' ? undefined : term.args;
