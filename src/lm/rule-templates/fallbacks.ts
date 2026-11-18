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
import { fromNarsese, getArgs, hasVariable, type Term, Truth } from '../../terms';
import { createTask, type Task, type TaskType } from '../../types';
import { lmTaskWeight } from '../task-weights.js';
import type { RuleFallback } from './definition.js';

/** A named fallback *is* the definition's fallback type; this alias names the role. */
export type SymbolicFallback = RuleFallback;

const task = (term: Term | string, type: TaskType, f = 0.5, c = 0.6): Task[] => {
  const parsed = typeof term === 'string' ? fromNarsese(term) : term;
  if (!parsed) return [];
  return [createTask(parsed, type, Truth.create(f, c), lmTaskWeight('fallback'))];
};

/** "X is Y" → (X --> Y). Template parser standing in for constrained JSON translation. */
export const templateTranslation: SymbolicFallback = (primary) => {
  const match = primary.toString().match(/([\w-]+)\s+is\s+(?:a|an|the)?\s*([\w-]+)/i);
  if (!match) return null;
  return task(`(${match[1]} --> ${match[2]})`, 'belief', 0.5, 0.4);
};

/** Structural match admitted as a NAL similarity belief. */
export const similarityFallback: SymbolicFallback = (primary, secondary) =>
  secondary ? task(`(${primary} <-> ${secondary})`, 'belief', 0.5, 0.5) : null;

/** NAL abduction stand-in: question the missing connector. */
export const abductionFallback: SymbolicFallback = (primary) =>
  task(`(?x --> ${primary})`, 'question', 0.5, 0.5);

/** Template decomposition: split conjunction goals into subgoals. */
export const conjunctionDecomposition: SymbolicFallback = (primary) => {
  if (primary.kind === 'conjunction' || primary.kind === 'sequence') {
    return getArgs(primary).flatMap((arg) => task(arg, 'goal', 0.9, 0.6));
  }
  return null;
};

/** NAL question generation: ask for the missing variable. */
export const curiosityQuestionFallback: SymbolicFallback = (primary) =>
  task(`(${primary} --> ?x)`, 'question', 0.5, 0.5);

/** Whether a term still carries a variable — the one lexical question a fallback may ask. */
export { hasVariable };

/** Causal stand-in: name the missing cause rather than inventing one. */
export const causalFallback: SymbolicFallback = (primary) =>
  task(`(?cause --> ${primary})`, 'question', 0.5, 0.5);

/** Elaboration stand-in: ask for the property the elaboration would have supplied. */
export const elaborationFallback: SymbolicFallback = (primary) =>
  task(`(${primary} --> ?property)`, 'question', 0.5, 0.4);

/** Clarification stand-in: the question whose answer unblocks the term. */
export const clarificationFallback: SymbolicFallback = (primary) =>
  task(`(?clarification --> ${primary})`, 'question', 0.5, 0.4);

/** Grounding stand-in: only a variable-bearing term has anything to ground. */
export const groundingFallback: SymbolicFallback = (primary) =>
  hasVariable(primary) ? task(`(${primary})`, 'belief', 0.5, 0.3) : null;

/** No symbolic equivalent: the rule degrades to producing nothing rather than guessing. */
export const noSymbolicEquivalent: SymbolicFallback = () => null;
