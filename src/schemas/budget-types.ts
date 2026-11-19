/**
 * Budget type schemas — shared between reasoning-budget and cognitive-events
 * to avoid circular dependency through the schemas barrel.
 */

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

export const BUDGET_TYPES = {
  cycles: 'cycles',
  depth: 'depth',
  memoryOps: 'memory',
  llmCalls: 'llm',
} as const;

export const BudgetTypeSchema = z.enum(Object.values(BUDGET_TYPES));

export type TerminationReason = z.infer<typeof TerminationReasonSchema>;
export type BudgetType = z.infer<typeof BudgetTypeSchema>;