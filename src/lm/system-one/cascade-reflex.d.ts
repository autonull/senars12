import type { ReasoningBudget } from '@senars/schemas';
import type { Perception } from '../../game/Game';
import type { ActionProposal, LearningEvent, Reflex } from '../../reflex/Reflex';
import type { EmbeddingPointer, JudgmentManifold } from './types';
/**
 * Two-stage placement fan-out (W7 / DQ2 — the first live `judgeCascade`
 * consumer). Stage-1 coarse-ranks the entire legal-action set in ONE batch
 * (one-prefill parity, Bench 35d); stage-2 fine-scores only the top-K when
 * the set exceeds K. Stage-2's query space is derived from stage-1's resolved
 * ranking — the cascade dependency, batched.
 */
export interface PlacementCascadeReflexOptions {
    /** Stage-2 fires only when the legal-action set exceeds this (DQ2: cap-gated). */
    topK?: number;
}
export declare class PlacementCascadeReflex implements Reflex<Perception, string> {
    #private;
    readonly id = "placement-cascade";
    readonly topK: number;
    constructor(fallback: Reflex<unknown, unknown>, options?: PlacementCascadeReflexOptions);
    /** Called at the attend stage of the same cycle, before propose. */
    prefetch(stateId: string, sharedContext: EmbeddingPointer, legalActions: readonly string[], manifold: JudgmentManifold, budget: ReasoningBudget): Promise<void>;
    /** Synchronous contract honored: reads the prefetch table (consume-once). */
    propose(state: Perception, legalActions: string[]): ActionProposal[];
    learn(event: LearningEvent): void;
}
//# sourceMappingURL=cascade-reflex.d.ts.map