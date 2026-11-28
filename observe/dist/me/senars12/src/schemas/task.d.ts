/**
 * Task type and punctuation schemas — the basic claim vocabulary.
 * Canonical definitions for task vocabulary (W3 Constant Canonicalization).
 */
import { z } from 'zod';
/** All task kinds including `command` which is not a bag kind. */
export declare const TASK_TYPES: readonly ['belief', 'goal', 'question', 'command'];
export type TaskType = (typeof TASK_TYPES)[number];
/** Task kinds that have bags (excludes `command`). */
export declare const TASK_BAG_KINDS: readonly ['belief', 'goal', 'question'];
export type TaskBagKind = (typeof TASK_BAG_KINDS)[number];
/** Punctuation marks for each task type. */
export declare const TASK_PUNCTUATIONS: readonly ['.', '!', '?', ';'];
export type TaskPunctuation = (typeof TASK_PUNCTUATIONS)[number];
/** Punctuation marks tolerated in input (includes empty for legacy). */
export declare const TOLERANT_PUNCTUATIONS: readonly ['', '.', '!', '?'];
export type TolerantPunctuation = (typeof TOLERANT_PUNCTUATIONS)[number];
/** Map from task type to its punctuation mark. */
export declare const TASK_PUNCTUATION: Record<TaskType, TaskPunctuation>;
/** Infer task type from punctuation mark. */
export declare const taskTypeForPunctuation: (p: string) => TaskType | null;
/** Zod schema for task type. */
export declare const TaskTypeSchema: z.ZodEnum<{
    belief: "belief";
    command: "command";
    goal: "goal";
    question: "question";
}>;
/** Zod schema for task bag kind. */
export declare const TaskBagKindSchema: z.ZodEnum<{
    belief: "belief";
    goal: "goal";
    question: "question";
}>;
/** Zod schema for task punctuation. */
export declare const TaskPunctuationSchema: z.ZodEnum<{
    "!": "!";
    ".": ".";
    ";": ";";
    "?": "?";
}>;
/** Zod schema for tolerant punctuation. */
export declare const TolerantPunctuationSchema: z.ZodEnum<{
    "": "";
    "!": "!";
    ".": ".";
    "?": "?";
}>;
//# sourceMappingURL=task.d.ts.map