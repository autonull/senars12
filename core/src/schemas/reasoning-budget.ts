/**
 * Reasoning budget schemas — explicit budget context passed to all
 * recursive/heavy functions. TerminationReason enums replace generic timeouts.
 *
 * The most-imported type in the repository, and the smallest module here:
 * gate → thread → focus → bag → derivation all pass this same object, so it is
 * deliberately free of any sibling schema.
 */

import { parseOrThrow } from '@senars/util';
import { z } from 'zod';

/** The five declared budget scopes (TODO29.a §5.7). */
export const BUDGET_SCOPE_IDS = [
  'derivations',
  'premises',
  'candidate-derivations',
  'proposal-application',
  'control-work',
  'decision-derivations',
] as const;

export type BudgetScopeId = (typeof BUDGET_SCOPE_IDS)[number];

export const TerminationReasonSchema = z.enum([
  'cycle-budget',
  'depth-budget',
  'memory-budget',
  'llm-budget',
  'deadline',
  'backpressure',
  'aborted',
  'completed',
]);

export const ConsumedBudgetSchema = z.object({
  cycles: z.number().int().nonnegative().default(0),
  depth: z.number().int().nonnegative().default(0),
  memoryOps: z.number().int().nonnegative().default(0),
  llmCalls: z.number().int().nonnegative().default(0),
});

/**
 * Each consumed key's event-level name, declared beside the schema that defines
 * the consumed keys — so the two vocabularies that describe one dimension cannot
 * drift, and `satisfies` fails if a dimension is added to one and not the other.
 *
 * `budgetType` used to be spelled inline in the event schema. Its five members
 * and this table's four could not see each other, which left `wallclock` an
 * admitted event field that no dimension produces and no reader has to handle:
 * a deadline is a `wallclockDeadlineMs`, and its exhaustion reason is `deadline`.
 */
export const BUDGET_TYPES = {
  cycles: 'cycles',
  depth: 'depth',
  memoryOps: 'memory',
  llmCalls: 'llm',
} as const satisfies Record<keyof ConsumedBudget, string>;

export const BudgetTypeSchema = z.enum(Object.values(BUDGET_TYPES));

/**
 * A zeroed consumption record.
 *
 * Declared here, beside the schema that is the type's definition, because the
 * schema's own default is one of the four places that needs it — and a default
 * that restates the record is a second place for a key to be missing. It was
 * `core/budget`'s export before, and the budget's arithmetic still reads it from
 * there.
 */
export const zeroConsumed = (): ConsumedBudget => ({
  cycles: 0,
  depth: 0,
  memoryOps: 0,
  llmCalls: 0,
});

export const ReasoningBudgetSchema = z.object({
  maxCycles: z.number().int().positive(),
  maxDepth: z.number().int().positive(),
  maxMemoryOps: z.number().int().positive(),
  maxLMCalls: z.number().int().nonnegative(),
  wallclockDeadlineMs: z.number().int().positive().optional(),
  abortSignal: z.unknown().optional(), // AbortSignal - cannot serialize, validated at runtime
  terminationReason: TerminationReasonSchema.optional(),
  consumed: ConsumedBudgetSchema.default(zeroConsumed),
});

export type ReasoningBudget = z.infer<typeof ReasoningBudgetSchema>;
export type ConsumedBudget = z.infer<typeof ConsumedBudgetSchema>;
export type TerminationReason = z.infer<typeof TerminationReasonSchema>;
export type BudgetType = z.infer<typeof BudgetTypeSchema>;

export const validateReasoningBudget = (budget: unknown): ReasoningBudget =>
  parseOrThrow(ReasoningBudgetSchema, 'ReasoningBudget', budget);
