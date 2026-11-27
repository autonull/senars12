/**
 * Task type and punctuation schemas — the basic claim vocabulary.
 * Canonical definitions for task vocabulary (W3 Constant Canonicalization).
 */
import { z } from 'zod';
/** All task kinds including `command` which is not a bag kind. */
export const TASK_TYPES = ['belief', 'goal', 'question', 'command'];
/** Task kinds that have bags (excludes `command`). */
export const TASK_BAG_KINDS = ['belief', 'goal', 'question'];
/** Punctuation marks for each task type. */
export const TASK_PUNCTUATIONS = ['.', '!', '?', ';'];
/** Punctuation marks tolerated in input (includes empty for legacy). */
export const TOLERANT_PUNCTUATIONS = ['', '.', '!', '?'];
/** Map from task type to its punctuation mark. */
export const TASK_PUNCTUATION = {
    belief: '.',
    goal: '!',
    question: '?',
    command: ';',
};
/** Infer task type from punctuation mark. */
export const taskTypeForPunctuation = (p) => {
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
