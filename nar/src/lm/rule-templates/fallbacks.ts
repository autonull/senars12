/**
 * Pure-NAL symbolic fallbacks for LM rules: zero LM dependency, safe on any model.
 * A fallback returning null skips the rule (no symbolic equivalent); [] degrades silently.
 */
import { fromNarsese, Truth, type Term } from '../../terms';
import { createBudget, createTask, type Task, type TaskType } from '../../types';

export type SymbolicFallback = (
  primary: Term,
  secondary?: Term,
  context?: Record<string, unknown>
) => Task[] | null;

const task = (term: Term | string, type: TaskType, f = 0.5, c = 0.6): Task[] => {
  const parsed = typeof term === 'string' ? fromNarsese(term) : term;
  if (!parsed) return [];
  return [createTask(parsed, type, Truth.create(f, c), createBudget(0.7))];
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
    return primary.args.flatMap((arg) => task(arg, 'goal', 0.9, 0.6));
  }
  return null;
};

/** NAL question generation: ask for the missing variable. */
export const curiosityQuestionFallback: SymbolicFallback = (primary) =>
  task(`(${primary} --> ?x)`, 'question', 0.5, 0.5);

/**
 * Universal rule matrix: one prompt + one symbolic fallback per rule.
 * Rules without a safe symbolic equivalent return null (skip) on LM failure.
 */
export const symbolicFallbacks: Record<string, SymbolicFallback> = {
  'lm-narsese-translation': templateTranslation,
  'lm-analogical-reasoning': similarityFallback,
  'lm-hypothesis-generation': abductionFallback,
  'lm-goal-decomposition': conjunctionDecomposition,
  'lm-curiosity-question': curiosityQuestionFallback,
  'lm-explanation-generation': () => null,
  'lm-belief-revision': () => null,
  // lm-meta-reasoning / lm-uncertainty-calibration: REPLACE dispositions (F5) —
  // served by the System One rule adapter; no symbolic equivalent, no generative call.
  'lm-schema-induction': () => null,
};
