/**
 * Reasoning control message schemas (§3.6).
 * These messages allow the UI to steer the reasoning engine (submit/step/run)
 * and perform authoring actions (retract/revise/add goal/adjust budget/provider).
 */
import { z } from 'zod';
import { msg } from './envelope.js';

const nonEmptyString = z.string().min(1);

export const ReasoningSubmitMsg = msg('reasoning.submit', {
  term: nonEmptyString,
  mode: z.enum(['belief', 'goal', 'question']).optional(),
});
export const ReasoningStepMsg = msg('reasoning.step', {});
export const ReasoningRunMsg = msg('reasoning.run', {});
export const ReasoningRetractMsg = msg('reasoning.retract', { nodeId: nonEmptyString });
export const ReasoningReviseMsg = msg('reasoning.revise', {
  nodeId: nonEmptyString,
  frequency: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});
export const ReasoningAddGoalMsg = msg('reasoning.add-goal', { term: nonEmptyString });
export const ReasoningAdjustBudgetMsg = msg('reasoning.adjust-budget', {
  budget: z.number().positive(),
});
export const ReasoningAdjustProviderMsg = msg('reasoning.adjust-provider', {
  provider: nonEmptyString,
});

export const ReasoningControlResponse = msg('reasoning.control.response', {
  ok: z.boolean(),
  message: z.string().optional(),
  seqId: z.number().optional(),
});

export type ReasoningSubmit = z.infer<typeof ReasoningSubmitMsg>;
export type ReasoningStep = z.infer<typeof ReasoningStepMsg>;
export type ReasoningRun = z.infer<typeof ReasoningRunMsg>;
export type ReasoningRetract = z.infer<typeof ReasoningRetractMsg>;
export type ReasoningRevise = z.infer<typeof ReasoningReviseMsg>;
export type ReasoningAddGoal = z.infer<typeof ReasoningAddGoalMsg>;
export type ReasoningAdjustBudget = z.infer<typeof ReasoningAdjustBudgetMsg>;
export type ReasoningAdjustProvider = z.infer<typeof ReasoningAdjustProviderMsg>;
export type ReasoningControlResponse = z.infer<typeof ReasoningControlResponse>;