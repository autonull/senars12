/**
 * Reasoning budget schemas — explicit budget context passed to all
 * recursive/heavy functions. TerminationReason enums replace generic timeouts.
 *
 * The most-imported type in the repository, and the smallest module here:
 * gate → thread → focus → bag → derivation all pass this same object, so it is
 * deliberately free of any sibling schema.
 */

import { nonNegativeInt, positiveInt, validatorFor } from '../config';
import { z } from 'zod';
import {
  BUDGET_SCOPE_IDS,
  BUDGET_TYPES,
  BudgetTypeSchema,
  TerminationReasonSchema,
  type BudgetScopeId,
  type BudgetType,
  type TerminationReason,
} from './budget-types.js';

export { BUDGET_SCOPE_IDS, BUDGET_TYPES, BudgetTypeSchema, TerminationReasonSchema };
export type { BudgetScopeId, BudgetType, TerminationReason };

export const ConsumedBudgetSchema = z.object({
  cycles: nonNegativeInt.default(0),
  depth: nonNegativeInt.default(0),
  memoryOps: nonNegativeInt.default(0),
  llmCalls: nonNegativeInt.default(0),
});

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
  maxCycles: positiveInt,
  maxDepth: positiveInt,
  maxMemoryOps: positiveInt,
  maxLMCalls: nonNegativeInt,
  wallclockDeadlineMs: positiveInt.optional(),
  abortSignal: z.unknown().optional(), // AbortSignal - cannot serialize, validated at runtime
  terminationReason: TerminationReasonSchema.optional(),
  consumed: ConsumedBudgetSchema.default(zeroConsumed),
});

export type ReasoningBudget = z.infer<typeof ReasoningBudgetSchema>;
export type ConsumedBudget = z.infer<typeof ConsumedBudgetSchema>;

export const validateReasoningBudget = validatorFor(ReasoningBudgetSchema, 'ReasoningBudget');
