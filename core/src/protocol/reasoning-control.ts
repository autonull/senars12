/**
 * Reasoning control message schemas (§3.6).
 * These messages allow the UI to steer the reasoning engine (submit/step/run)
 * and perform authoring actions (retract/revise/add goal/adjust budget/provider).
 */
import { z } from 'zod';
import { msg } from './envelope.js';

const nonEmptyString = z.string().min(1);

/**
 * The correlation the client stamps on every control request and the engine
 * echoes on its response, so a reply settles the promise that asked for it
 * rather than whichever one a run/abort race happens to reply to first.
 */
const correlation = { seqId: z.number().optional() };

export const ReasoningSubmitMsg = msg('reasoning.submit', {
  term: nonEmptyString,
  mode: z.enum(['belief', 'goal', 'question']).optional(),
  ...correlation,
});
export const ReasoningStepMsg = msg('reasoning.step', { ...correlation });
export const ReasoningRunMsg = msg('reasoning.run', { ...correlation });
export const ReasoningAbortMsg = msg('reasoning.abort', { ...correlation });
export const ReasoningRetractMsg = msg('reasoning.retract', { nodeId: nonEmptyString, ...correlation });
export const ReasoningReviseMsg = msg('reasoning.revise', {
  nodeId: nonEmptyString,
  frequency: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  ...correlation,
});
export const ReasoningAddGoalMsg = msg('reasoning.add-goal', { term: nonEmptyString, ...correlation });
export const ReasoningAdjustBudgetMsg = msg('reasoning.adjust-budget', {
  budget: z.number().positive(),
  ...correlation,
});
export const ReasoningAdjustProviderMsg = msg('reasoning.adjust-provider', {
  provider: nonEmptyString,
  ...correlation,
});

export const ReasoningControlResponse = msg('reasoning.control.response', {
  ok: z.boolean(),
  message: z.string().optional(),
  ...correlation,
});

export type ReasoningSubmit = z.infer<typeof ReasoningSubmitMsg>;
export type ReasoningStep = z.infer<typeof ReasoningStepMsg>;
export type ReasoningRun = z.infer<typeof ReasoningRunMsg>;
export type ReasoningAbort = z.infer<typeof ReasoningAbortMsg>;
export type ReasoningRetract = z.infer<typeof ReasoningRetractMsg>;
export type ReasoningRevise = z.infer<typeof ReasoningReviseMsg>;
export type ReasoningAddGoal = z.infer<typeof ReasoningAddGoalMsg>;
export type ReasoningAdjustBudget = z.infer<typeof ReasoningAdjustBudgetMsg>;
export type ReasoningAdjustProvider = z.infer<typeof ReasoningAdjustProviderMsg>;
export type ReasoningControlResponse = z.infer<typeof ReasoningControlResponse>;