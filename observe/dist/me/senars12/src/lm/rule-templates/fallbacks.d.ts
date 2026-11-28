/**
 * Pure-NAL symbolic fallbacks for LM rules: zero LM dependency, safe on any model.
 * A fallback returning null skips the rule (no symbolic equivalent); [] degrades silently.
 *
 * These are named functions rather than rows in a table keyed by rule id. The
 * table looked up `symbolicFallbacks[def.id]` from each definition, which meant a
 * rule and its fallback agreed only by two identical string literals — rename one
 * and the lookup answered `undefined`, which the type accepted as "no fallback".
 * Binding the function in the definition makes that unrepresentable.
 */
import { hasVariable } from '../../terms';
import type { RuleFallback } from './definition';
/** A named fallback *is* the definition's fallback type; this alias names the role. */
export type SymbolicFallback = RuleFallback;
/** "X is Y" → (X --> Y). Template parser standing in for constrained JSON translation. */
export declare const templateTranslation: SymbolicFallback;
/** Structural match admitted as a NAL similarity belief. */
export declare const similarityFallback: SymbolicFallback;
/** NAL abduction stand-in: question the missing connector. */
export declare const abductionFallback: SymbolicFallback;
/** Template decomposition: split conjunction goals into subgoals. */
export declare const conjunctionDecomposition: SymbolicFallback;
/** NAL question generation: ask for the missing variable. */
export declare const curiosityQuestionFallback: SymbolicFallback;
/** Whether a term still carries a variable — the one lexical question a fallback may ask. */
export { hasVariable };
/** Causal stand-in: name the missing cause rather than inventing one. */
export declare const causalFallback: SymbolicFallback;
/** Elaboration stand-in: ask for the property the elaboration would have supplied. */
export declare const elaborationFallback: SymbolicFallback;
/** Clarification stand-in: the question whose answer unblocks the term. */
export declare const clarificationFallback: SymbolicFallback;
/** Grounding stand-in: only a variable-bearing term has anything to ground. */
export declare const groundingFallback: SymbolicFallback;
/** No symbolic equivalent: the rule degrades to producing nothing rather than guessing. */
export declare const noSymbolicEquivalent: SymbolicFallback;
//# sourceMappingURL=fallbacks.d.ts.map