import type { ReasoningBudget } from '@senars/schemas';
import type { Perception } from '../../game/Game';
import type { ActionProposal, LearningEvent, Reflex } from '../../reflex/Reflex';
import type { ContrastiveMemory } from './contrastive';
import type { JudgmentDataset } from './distill';
import { DecisionReadout } from './reflex-readout';
import type { CognitiveDispatcher, EmbeddingCache, EmbeddingPointer } from './types';
export interface LMReflexOptions {
    /** Incumbent reflex served when the LM is cold, failed, or breaker-open (C2). */
    fallback: Reflex<unknown, unknown>;
    dispatcher: CognitiveDispatcher;
    embeddingCache: EmbeddingCache;
    budget: ReasoningBudget;
    dataset?: JudgmentDataset;
    /** Game semantics appended to the decision prompt (e.g. '0=up, 1=right, ...'). */
    actionLegend?: string;
    /** Narrative decision prompt with `{feature}` placeholders interpolated from
     *  the observation. Small models reason reliably over sentences, not
     *  `key=value` digests; the digest is the fallback. */
    promptTemplate?: string;
    /** Max GBNF-constrained candidates the LM may propose per decision (C1). */
    maxCandidates?: number;
    /** CLM contrastive verification: proposals near stored hard negatives are demoted. */
    contrastive?: ContrastiveMemory;
}
/**
 * Real-LM per-tick decision reflex (TODO17 C1): at the prefetch (attend) stage
 * the LM proposes ranked candidates under a generated GBNF grammar enumerating
 * the legal-action set; the manifold judges them (reflex_value / feasibility /
 * risk). The synchronous propose contract reads the warm table; cold/failure
 * ⇒ fallback reflex. The LM arm feeds the distillation flywheel (C3).
 */
export declare class LMReflex extends DecisionReadout implements Reflex<Perception, string> {
    #private;
    readonly id = "lm-reflex";
    readonly embeddingCache: EmbeddingCache;
    readonly budget: ReasoningBudget;
    failures: number;
    /** Distillation rows recorded WITH an embedding (vector-joinable at training). */
    embeddedRows: number;
    decisions: number;
    /** Warm decisions actually served at propose (diagnoses cold/missed hand-offs). */
    served: number;
    /** Proposals rejected or demoted by contrastive verification (CLM telemetry). */
    contrastiveVetoes: number;
    constructor(options: LMReflexOptions);
    /** Attend-stage: LM proposes + manifold judges (the only await, C2). */
    prefetch(stateId: string, context: EmbeddingPointer, legalActions: readonly string[], _manifold?: unknown, _budget?: ReasoningBudget, observation?: Perception): Promise<void>;
    /** Synchronous contract: warm LM decision, else fallback. */
    propose(state: Perception, legalActions: string[]): ActionProposal[];
    learn(event: LearningEvent): void;
}
//# sourceMappingURL=lm-reflex.d.ts.map