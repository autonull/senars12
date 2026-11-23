/**
 * Task type and punctuation schemas — the basic claim vocabulary.
 * Canonical definitions for task vocabulary (W3 Constant Canonicalization).
 */

import { z } from 'zod';

/** All task kinds including `command` which is not a bag kind. */
export const TASK_TYPES = ['belief', 'goal', 'question', 'command'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

/** Task kinds that have bags (excludes `command`). */
export const TASK_BAG_KINDS = ['belief', 'goal', 'question'] as const;
export type TaskBagKind = (typeof TASK_BAG_KINDS)[number];

/** Punctuation marks for each task type. */
export const TASK_PUNCTUATIONS = ['.', '!', '?', ';'] as const;
export type TaskPunctuation = (typeof TASK_PUNCTUATIONS)[number];

/** Punctuation marks tolerated in input (includes empty for legacy). */
export const TOLERANT_PUNCTUATIONS = ['', '.', '!', '?'] as const;
export type TolerantPunctuation = (typeof TOLERANT_PUNCTUATIONS)[number];

/** Map from task type to its punctuation mark. */
export const TASK_PUNCTUATION: Record<TaskType, TaskPunctuation> = {
  belief: '.',
  goal: '!',
  question: '?',
  command: ';',
} as const;

/** Infer task type from punctuation mark. */
export const taskTypeForPunctuation = (p: string): TaskType | null => {
  switch (p) {
    case '.': return 'belief';
    case '!': return 'goal';
    case '?': return 'question';
    case ';': return 'command';
    default: return null;
  }
};

/** Zod schema for task type. */
export const TaskTypeSchema = z.enum(TASK_TYPES);

/** Zod schema for task bag kind. */
export const TaskBagKindSchema = z.enum(TASK_BAG_KINDS);

/** Zod schema for task punctuation. */
export const TaskPunctuationSchema = z.enum(TASK_PUNCTUATIONS);

/** Zod schema for tolerant punctuation. */
export const TolerantPunctuationSchema = z.enum(TOLERANT_PUNCTUATIONS);