import type { ReasoningBudget } from '@senars/schemas';
import type { Perception } from '../../game/Game';
import type { ActionProposal, LearningEvent, Reflex } from '../../reflex/Reflex';
import type { JudgmentDataset } from './distill';
import { DecisionReadout } from './reflex-readout';
import type { EmbeddingPointer, JudgmentManifold } from './types';
/** Optional distillation wiring (C4): record reflex decisions as training labels. */
export interface ManifoldReflexOptions {
    dataset?: JudgmentDataset;
}
/**
 * Semantic reflex (§7.3): bridges the synchronous `Reflex.propose` contract to
 * the asynchronous Manifold by serving proposals from a judgment table
 * prefetched at the attend stage of the same cycle. Falls back to the
 * incumbent reflex when the table is cold.
 */
export declare class ManifoldReflex extends DecisionReadout implements Reflex<Perception, string> {
    #private;
    readonly id = "manifold-reflex";
    constructor(fallback: Reflex<unknown, unknown>, options?: ManifoldReflexOptions);
    /** Called at the attend stage of the same cycle, before propose. */
    prefetch(stateId: string, sharedContext: EmbeddingPointer, legalActions: readonly string[], manifold: JudgmentManifold, budget: ReasoningBudget, _observation?: unknown): Promise<void>;
    /** Synchronous contract honored: reads the prefetch table (consume-once for bounded memory). */
    propose(state: Perception, legalActions: string[]): ActionProposal[];
    learn(event: LearningEvent): void;
}
//# sourceMappingURL=manifold-reflex.d.ts.map