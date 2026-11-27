import type { BandDecision, EmbeddingPointer, EvaluateProposition, EvaluateQuery, JudgmentProposition, JudgmentQuery, ReasoningBudget } from './types';
/** Jev `Noul`: an Evaluate over the boolean anchor pair, read off the head that owns it. */
export declare function truthProbability(statement: string): EvaluateQuery;
/** Extracts P(true) from a `truthProbability` proposition; undefined when it abstained. */
export declare function truthProbabilityOf(p: EvaluateProposition): number | undefined;
/**
 * The decision layer owns the band vocabulary; the router that reads it re-exports.
 * A stricter router can only restrict: `isRestrictive` is the whole test, analytically
 * over the thresholds, so the 101-sample search that used to check it had no callers
 * left once the ladder became one declaration.
 */
export type { BandDecision };
type Rung = Exclude<BandDecision, 'abstain'>;
/** One threshold per rung: `p >= rung` routes to `rung`, first match wins, else `block`. */
export type ConfidenceBands = Record<Rung, number>;
/** The routing bands a router gets when nothing else says: `act` is the top rung, so
 *  it is also the threshold at which a decision is no longer in doubt — which is why
 *  the decider's safety-floor short-circuit and the pipeline's band table both read
 *  it rather than restating a number. */
export declare const DEFAULT_CONFIDENCE_BANDS: ConfidenceBands;
/** Monotone band routing: the first rung whose threshold `p` clears, else `block`. */
export declare const routeConfidence: (p: number, bands: ConfidenceBands) => Rung;
/** True iff `candidate` can only restrict relative to `incumbent` (monotonicity). */
export declare const isRestrictive: (candidate: ConfidenceBands, incumbent: ConfidenceBands) => boolean;
/**
 * Confidence-gated routing (Jev pattern): maps calibrated confidence to
 * act/review/block bands. A router may only restrict — never promote a
 * proposition past a looser router's decision.
 */
export declare class ConfidenceRouter {
    readonly bands: ConfidenceBands;
    constructor(bands: ConfidenceBands);
    /** Default router equivalent to the legacy bare-`p < τ` split (block never fires). */
    static fromThreshold(threshold: number): ConfidenceRouter;
    route(input: {
        abstained?: boolean;
        score?: number;
        top?: {
            p: number;
        };
    } | number): BandDecision;
}
export interface CompositeEntry {
    /** Aggregation key (head rubric or slot id). */
    key: string;
    /** Confidence/probability in [0,1]; abstained entries are excluded. */
    p: number;
    abstained?: boolean;
}
export interface CompositeContribution {
    key: string;
    /** The entry's share of the total weight — already normalized. */
    weight: number;
    p: number;
}
export interface CompositeScore {
    score: number;
    contributions: readonly CompositeContribution[];
}
/**
 * Normalized weighted aggregation (Jev composite scoring): weights are declared
 * config, re-normalized over the non-abstained entries. All abstained ⇒ undefined.
 */
export declare function compositeScore(entries: readonly CompositeEntry[], weights: Record<string, number>): CompositeScore | undefined;
export interface CascadeJudge {
    judgeBatch(sharedContext: EmbeddingPointer, queries: readonly JudgmentQuery[], budget: ReasoningBudget): Promise<JudgmentProposition[]>;
}
export interface CascadeResult {
    stage1: JudgmentProposition;
    stage2?: JudgmentProposition;
}
/**
 * Two-stage dependency / hierarchical classification (Jev pattern): stage-2's
 * query space is derived from stage-1's resolved top.
 */
export declare function judgeCascade(judge: CascadeJudge, sharedContext: EmbeddingPointer, stage1: JudgmentQuery, stage2Factory: (stage1: JudgmentProposition) => JudgmentQuery | undefined, budget: ReasoningBudget): Promise<CascadeResult>;
//# sourceMappingURL=policy.d.ts.map