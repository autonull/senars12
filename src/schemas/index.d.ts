/**
 * Unified schema barrel — re-exports all contracts from the generated genome.
 *
 * This is the single public surface for all kernel contracts. The actual
 * definitions live in the genome (`src/formats/genome.ts`) and are emitted to
 * `src/generated/schemas.ts`.
 */
export * from '@senars/generated';
export { TASK_TYPES, TASK_BAG_KINDS, TASK_PUNCTUATIONS, TOLERANT_PUNCTUATIONS, TASK_PUNCTUATION, taskTypeForPunctuation, TaskTypeSchema, TaskBagKindSchema, TaskPunctuationSchema, TolerantPunctuationSchema, } from './task';
export type { TaskType, TaskBagKind, TaskPunctuation, TolerantPunctuation, } from './task';
//# sourceMappingURL=index.d.ts.map