/**
 * Kernel Terms — barrel export.
 */
export * from './term-internal';
export * from './codec/narsese';
export { escapeConstant, getOperatorSymbol, getPrecedence, formatTerm, fromNarsese } from './term-internal/canonical';
export { getPunctuation } from './codec/formatters';
export { termInterner, termEquals, termHash, termComplexity, termFromJSON, termToJSON, visitTerm, mapTerm, findSubterms, getVariables, getConstants, substitute, containsVariable, getVariableSet, renameVariables as internRenameVariables, standardizeApart as internStandardizeApart, isUnifiable as internIsUnifiable, isCompound, isAtomic } from './intern';
export type { TermJSON, TermVisitor } from './intern';
export { unify, composeSubst, applySubstitution, unifyAll, antiUnify, match, getSubstitutionVariables, getSubstitutionTerms, invertSubstitution, type Substitution, type UnifyResult, type UnifyOptions, type AntiUnifyResult, type MatchResult } from './unify';
//# sourceMappingURL=index.d.ts.map