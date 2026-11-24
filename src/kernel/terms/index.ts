/**
 * Kernel Terms — barrel export.
 */

export * from './term-internal';
export * from './codec/narsese';
// Re-export canonical functions (from term-internal/canonical via term-internal)
export { escapeConstant, getOperatorSymbol, getPrecedence, formatTerm, fromNarsese } from './term-internal/canonical';
export { getPunctuation } from './codec/formatters';
// intern and unify are internal implementation details; re-export only what's needed
export { termInterner, termEquals, termHash, termComplexity, termFromJSON, termToJSON, type TermJSON, TermVisitor, visitTerm, mapTerm, findSubterms, getVariables, getConstants, substitute, containsVariable, getVariableSet, renameVariables as internRenameVariables, standardizeApart as internStandardizeApart, isUnifiable as internIsUnifiable, isCompound, isAtomic } from './intern';
export { unify, composeSubst, applySubstitution, unifyAll, antiUnify, match, getSubstitutionVariables, getSubstitutionTerms, invertSubstitution, type Substitution, type UnifyResult, type UnifyOptions, type AntiUnifyResult, type MatchResult } from './unify';