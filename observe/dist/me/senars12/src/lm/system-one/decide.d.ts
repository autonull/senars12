import type { AbstainReason, CognitiveAxis } from '../../decision/types';
import { type ContrastiveMemory } from './contrastive';
import { type BandDecision, type CompositeScore, type ConfidenceBands, ConfidenceRouter } from './policy';
import type { EmbeddingCache, EmbeddingPointer, JudgmentProposition, JudgmentQuery, ReasoningBudget, RubricId, ScoreDistribution } from './types';
export interface JudgmentProvenance {
    modelDigest?: string;
    calibrationDigest?: string;
    /** SHA-256 of the judged context text (or the candidate set, for `choose`). */
    inputDigest: string;
    contrastiveDigest?: string;
    fitted: boolean;
    abstained: boolean;
    band: BandDecision;
    timestamp: number;
}
export interface HeadVerdict {
    query: JudgmentQuery;
    proposition?: JudgmentProposition;
    band: BandDecision;
    abstained: boolean;
    abstainReason?: JudgmentProposition['abstainReason'];
    /** Phase 5 short-circuit: head omitted at the query-composition layer. */
    skipped: boolean;
}
export interface ContrastiveVerdict {
    /** Cross-rubric in-domain-ness score (undefined when no exemplars). */
    score?: number;
    /** Hard-negative proximity penalty in [0,1] (1 − score). */
    penalty?: number;
}
export interface DecideResult {
    contextPointer: EmbeddingPointer;
    verdicts: readonly HeadVerdict[];
    composite?: CompositeScore;
    contrastive: ContrastiveVerdict;
    /** Most restrictive band across heads (monotone-restrict-only). */
    band: BandDecision;
    abstained: boolean;
    abstainReason?: AbstainReason;
    provenance: JudgmentProvenance;
}
export interface DecideRequest {
    context: string;
    queries: readonly JudgmentQuery[];
    budget: ReasoningBudget;
    /** Router bands; defaults to { act: 0.8, review: 0.5 }. */
    bands?: ConfidenceBands;
    /** Composite weights keyed by rubric. */
    weights?: Record<string, number>;
    /** Rubric-scoped contrastive scoring; default is cross-rubric in-domain-ness. */
    contrastiveRubric?: string;
}
export type TieredJudge = (sharedContext: EmbeddingPointer, queries: readonly JudgmentQuery[], budget: ReasoningBudget) => Promise<JudgmentProposition[]>;
export interface DecideDeps {
    /** Tiered judge path (dispatcher.judge) so tier0/3 fallbacks + budget charging are preserved. */
    judge: TieredJudge;
    embeddingCache: EmbeddingCache;
    contrastive?: ContrastiveMemory;
    router?: ConfidenceRouter;
    weights?: Record<string, number>;
    /** Chunk size for `judgeBatch` maxBatchSize enforcement (never silently truncates). */
    maxBatchSize?: number;
    calibrationDigest?: string;
    contrastiveDigest?: string;
}
export interface Decider {
    decide(request: DecideRequest): Promise<DecideResult>;
    choose(request: ChooseRequest): Promise<ChooseResult>;
}
export interface ProvenanceOverrides {
    modelDigest?: string;
    calibrationDigest?: string;
    contrastiveDigest?: string;
    fitted?: boolean;
}
export declare const isFitted: (p: JudgmentProposition | undefined) => boolean;
/** Digest pinning a proposition's calibration to its model — absent when unfitted. */
export declare const calibrationDigestOf: (p: JudgmentProposition | undefined) => string | undefined;
/** The single provenance constructor: every judgment path pins the same digest identity. */
export declare function provenanceFrom(proposition: JudgmentProposition | undefined, inputDigest: string, band: BandDecision, abstained: boolean, overrides?: ProvenanceOverrides): JudgmentProvenance;
/**
 * Provenance for a staged judgment chain: the winning stage (last judged
 * non-empty) supplies the digest identity, any fitted stage lifts `fitted`.
 */
export declare function stageProvenance(stages: readonly (JudgmentProposition | undefined)[], inputDigest: string, band: BandDecision, abstained: boolean, overrides?: ProvenanceOverrides): JudgmentProvenance;
export declare function createDecider(deps: DecideDeps): Decider;
export interface ChooseRequest {
    context: string;
    candidates: readonly string[];
    budget: ReasoningBudget;
    instruction?: string;
    rubric?: RubricId;
    axis?: CognitiveAxis;
    /** Contrastive score below this vetoes a candidate (0 = no vetoing). */
    verificationFloor?: number;
    /** Pre-scored ranking (e.g. an upstream judge's ordered candidates). When
     *  supplied, `choose()` applies only contrastive penalties/vetoes — no
     *  candidate_select head invocation. */
    preScored?: readonly ScoreDistribution[];
}
export interface ChooseResult {
    selected?: string;
    distribution: readonly ScoreDistribution[];
    /** Distribution sorted by adjusted score descending (the selection order). */
    ranked: readonly ScoreDistribution[];
    abstained: boolean;
    abstainReason?: AbstainReason;
    contrastive: {
        penalties: Record<string, number>;
        vetoes: readonly string[];
    };
    provenance: JudgmentProvenance;
}
//# sourceMappingURL=decide.d.ts.map