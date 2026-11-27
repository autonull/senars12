/**
 * Unified schema barrel — re-exports all contracts from the generated genome.
 *
 * This is the single public surface for all kernel contracts. The actual
 * definitions live in the genome (`src/formats/genome.ts`) and are emitted to
 * `src/generated/schemas.ts`.
 */
// Re-export everything from generated schemas (single source of truth)
export * from '@senars/generated';
// Explicit re-exports for task vocabulary items that the generated schemas may not include
export { TASK_TYPES, TASK_BAG_KINDS, TASK_PUNCTUATIONS, TOLERANT_PUNCTUATIONS, TASK_PUNCTUATION, taskTypeForPunctuation, TaskTypeSchema, TaskBagKindSchema, TaskPunctuationSchema, TolerantPunctuationSchema, } from './task';
