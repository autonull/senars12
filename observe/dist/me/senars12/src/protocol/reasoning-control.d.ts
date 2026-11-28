/**
 * Reasoning control message schemas (§3.6).
 * These messages allow the UI to steer the reasoning engine (submit/step/run)
 * and perform authoring actions (retract/revise/add goal/adjust budget/provider).
 */
import { z } from 'zod';
export declare const ReasoningSubmitMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    term: z.ZodString;
    mode: z.ZodOptional<z.ZodEnum<{
        belief: "belief";
        goal: "goal";
        question: "question";
    }>>;
    type: z.ZodLiteral<"reasoning.submit">;
}, z.core.$strip>;
/**
 * Ask the engine a question and get the answer *with* its verified derivation
 * (M8, Flow B). The server admits the question, reasons, then joins the recorder
 * to the answer, so the proof is one round-trip rather than a 2s drain away.
 */
export declare const ReasoningAskMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    term: z.ZodString;
    runs: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"reasoning.ask">;
}, z.core.$strip>;
export declare const ReasoningStepMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"reasoning.step">;
}, z.core.$strip>;
export declare const ReasoningRunMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"reasoning.run">;
}, z.core.$strip>;
export declare const ReasoningAbortMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"reasoning.abort">;
}, z.core.$strip>;
export declare const ReasoningRetractMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    nodeId: z.ZodString;
    type: z.ZodLiteral<"reasoning.retract">;
}, z.core.$strip>;
export declare const ReasoningReviseMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    nodeId: z.ZodString;
    frequency: z.ZodNumber;
    confidence: z.ZodNumber;
    type: z.ZodLiteral<"reasoning.revise">;
}, z.core.$strip>;
export declare const ReasoningAddGoalMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    term: z.ZodString;
    type: z.ZodLiteral<"reasoning.add-goal">;
}, z.core.$strip>;
export declare const ReasoningAdjustBudgetMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    budget: z.ZodNumber;
    type: z.ZodLiteral<"reasoning.adjust-budget">;
}, z.core.$strip>;
export declare const ReasoningAdjustProviderMsg: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    provider: z.ZodString;
    type: z.ZodLiteral<"reasoning.adjust-provider">;
}, z.core.$strip>;
export declare const ReasoningControlResponse: z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    ok: z.ZodBoolean;
    message: z.ZodOptional<z.ZodString>;
    answer: z.ZodOptional<z.ZodObject<{
        answer: z.ZodOptional<z.ZodString>;
        frequency: z.ZodOptional<z.ZodNumber>;
        confidence: z.ZodOptional<z.ZodNumber>;
        hasDerivation: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    termination: z.ZodOptional<z.ZodArray<z.ZodObject<{
        scope: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>>>;
    type: z.ZodLiteral<"reasoning.control.response">;
}, z.core.$strip>;
export type ReasoningSubmit = z.infer<typeof ReasoningSubmitMsg>;
export type ReasoningAsk = z.infer<typeof ReasoningAskMsg>;
export type ReasoningStep = z.infer<typeof ReasoningStepMsg>;
export type ReasoningRun = z.infer<typeof ReasoningRunMsg>;
export type ReasoningAbort = z.infer<typeof ReasoningAbortMsg>;
export type ReasoningRetract = z.infer<typeof ReasoningRetractMsg>;
export type ReasoningRevise = z.infer<typeof ReasoningReviseMsg>;
export type ReasoningAddGoal = z.infer<typeof ReasoningAddGoalMsg>;
export type ReasoningAdjustBudget = z.infer<typeof ReasoningAdjustBudgetMsg>;
export type ReasoningAdjustProvider = z.infer<typeof ReasoningAdjustProviderMsg>;
export type ReasoningControlResponse = z.infer<typeof ReasoningControlResponse>;
//# sourceMappingURL=reasoning-control.d.ts.map