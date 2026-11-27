import type { ReasoningBudget } from '@senars/schemas';
import type { JudgmentDataset } from './distill';
import type { EmbeddingCache, JudgmentManifold } from './types';
export type WakeDecision = 'wake' | 'not_yet' | 'unrelated';
export interface WakeVerdict {
    decision: WakeDecision;
    score?: number;
    abstained: boolean;
    /** Why the verdict was reached (user-input, relevance bands, fail-open paths). */
    reason: string;
}
export interface WakeGateOptions {
    manifold: JudgmentManifold;
    embeddingCache: EmbeddingCache;
    budget?: ReasoningBudget;
    /** relevance ≥ wakeThreshold ⇒ wake. */
    wakeThreshold?: number;
    /** wakeThreshold > relevance ≥ notYetThreshold ⇒ not_yet; below ⇒ unrelated. */
    notYetThreshold?: number;
    /** Hash-only label per judged sleep note when supplied. */
    dataset?: JudgmentDataset;
    source?: string;
}
/**
 * E5 wake gate (Jev wake pattern): before a timer/consolidation-driven wake,
 * judge the sleep note with the `relevance` head — one evaluate per note.
 * User input always wakes without a judgment. Unfitted/abstaining heads and
 * manifold failure fail open (`wake`) — timers waking is the pre-gate behavior,
 * so uncertainty must never stall a sleeping agent.
 */
export declare function createWakeGate(options: WakeGateOptions): (sleepNote: string, hint?: {
    userInput?: boolean;
}) => Promise<WakeVerdict>;
//# sourceMappingURL=wake-gate.d.ts.map