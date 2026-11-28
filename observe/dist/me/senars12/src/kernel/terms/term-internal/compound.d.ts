/**
 * Compound Term Operations — utilities for compound terms.
 */
import type { Term, CompoundTerm } from './types';
/** Get term arguments. */
export declare function getArgs(term: Term): readonly Term[];
/** Check if term is an inheritance statement. */
export declare function isInheritance(term: Term): boolean;
/** Check if term is a conjunction. */
export declare function isConjunction(term: Term): boolean;
/** Check if term is a disjunction. */
export declare function isDisjunction(term: Term): boolean;
/** Check if term is a negation. */
export declare function isNegation(term: Term): boolean;
/** Check if term is a similarity. */
export declare function isSimilarity(term: Term): boolean;
/** Check if term is an implication. */
export declare function isImplication(term: Term): boolean;
/** Check if term is an equivalence. */
export declare function isEquivalence(term: Term): boolean;
/** Check if term is a statement (inheritance, similarity, etc.). */
export declare function isStatement(term: Term): boolean;
/** Check if term is a question (uses STATEMENT/QUESTION/GOAL punctuation). */
export declare function isQuestion(term: Term): boolean;
/** Check if term is a goal (uses STATEMENT/QUESTION/GOAL punctuation). */
export declare function isGoal(term: Term): boolean;
/** Check if term is atomic (variable or constant). */
export declare function isAtomic(term: Term): boolean;
/** Check if term is compound (not atomic). */
export declare function isCompound(term: Term): term is CompoundTerm;
/** Check if term has any variables. */
export declare function hasVariable(term: Term): boolean;
/** Get all symbols in a term. */
export declare function getSymbols(term: Term): Set<string>;
/** Check if two terms share any symbol. */
export declare function sharesSymbol(a: Term, b: Term): boolean;
/** Calculate structural similarity between two terms (0-1). */
export declare function calculateSimilarity(a: Term, b: Term): number;
/** Visit all subterms. */
export declare function visitTerms(term: Term, visitor: (t: Term) => void): void;
/** Create a term key for hashing/lookup. */
export declare function termKey(term: Term): string;
//# sourceMappingURL=compound.d.ts.map