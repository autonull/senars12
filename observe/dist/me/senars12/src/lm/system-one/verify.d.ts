/**
 * P2 (TODO19): SDE-style verify cascade + consensus fan-out as a budget knob.
 * Thin compositions over `judgeCascade`, `ConfidenceRouter`, and the manifold's
 * self-consistency `consensus` — no new machinery.
 */
import { type JudgmentProvenance } from './decide';
import type { BandDecision } from './policy';
import { type CascadeJudge, type ConfidenceBands } from './policy';
import type { EmbeddingPointer, JudgmentProposition, JudgmentQuery, ReasoningBudget } from './types';
export interface VerifyResult {
    decision: BandDecision;
    /** Stage-1 plausibility (P(true)); undefined on abstain. */
    p: number | undefined;
    /** Stage-2 verification proposition — present only when the router escalated. */
    verification?: JudgmentProposition;
    /** Provenance matching Decider's JudgmentProvenance for auditability. */
    provenance: JudgmentProvenance;
}
/**
 * SDE-style verify cascade: cheap stage-1 self-eval routes through the
 * confidence bands; the expensive stage-2 verification fires only on
 * `review`/`block` — never re-verifying an `act`.
 */
export declare function verifyCascade(judge: CascadeJudge, sharedContext: EmbeddingPointer, statement: string, bands: ConfidenceBands, budget: ReasoningBudget): Promise<VerifyResult>;
export interface ConsensusJudge {
    consensus(sharedContext: EmbeddingPointer, query: JudgmentQuery, k: number, budget: ReasoningBudget): Promise<{
        proposition: JudgmentProposition;
        agreement: number;
        independent: boolean;
    }>;
}
/** Fan-out never exceeds the LM-call budget remaining; k≥1 always degrades to a single judgment. */
export declare const fanoutWithinBudget: (k: number, budget: ReasoningBudget, charged?: number) => number;
/** Consensus fan-out as a budget knob: the requested k is clamped to remaining budget. */
export declare function consensusFanout(judge: ConsensusJudge, sharedContext: EmbeddingPointer, query: JudgmentQuery, k: number, budget: ReasoningBudget, charged?: number): Promise<{
    proposition: JudgmentProposition;
    agreement: number;
    independent: boolean;
}>;
//# sourceMappingURL=verify.d.ts.map