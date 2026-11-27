/**
 * Metareasoning — think vs act decisions for the economy scheduler.
 */
import type { EconomyTask, MetareasoningResult, MetareasoningDecision, SchedulerConfig, Successor } from '../types';
/** Metareasoning context. */
export interface MetareasoningContext {
    /** Top candidate. */
    top: EconomyTask;
    /** Second candidate. */
    second?: EconomyTask;
    /** All candidates. */
    candidates: EconomyTask[];
    /** Current iteration. */
    iteration: number;
    /** Budget remaining. */
    budgetRemaining: number;
    /** Time pressure (0-1). */
    timePressure: number;
    /** Current total utility. */
    totalUtility: number;
    /** Successors map. */
    successors: Map<string, Successor[]>;
    /** Scheduler config. */
    config: SchedulerConfig;
}
/**
 * Decide whether to think or act based on judgment margin.
 *
 * If the margin between top and second candidate is small, think (explore).
 * If the margin is large, act (exploit).
 */
export declare function metareason(context: MetareasoningContext): MetareasoningResult;
/**
 * Calculate the metareasoning budget allocation.
 */
export declare function calculateMetareasoningBudget(context: MetareasoningContext, decision: MetareasoningDecision): number;
/**
 * Evaluate the outcome of a metareasoning decision.
 */
export declare function evaluateMetareasoningOutcome(decision: MetareasoningDecision, actualUtility: number, expectedUtility: number, budgetUsed: number): {
    score: number;
    feedback: string;
};
//# sourceMappingURL=metareasoning.d.ts.map