/**
 * Shadow validation (TODO13 3.3): LLM-generated Narsese tasks are checked
 * against the current belief set before admission. A candidate that produces a
 * contradiction (same term, divergent frequency) is silently dropped and the
 * rule's symbolic fallback stands.
 */
import type { JudgmentDataset } from '../lm/system-one/distill';
import type { SystemOneLMRuleAdapter } from '../lm/system-one/rule-adapter';
import { type Term, type Truth } from '../terms';
export interface BeliefLike {
    term: Term;
    truth?: Truth;
}
export interface ShadowCheckOptions {
    /** Maximum frequency divergence tolerated before the candidate is rejected. */
    maxFrequencyDelta?: number;
    /** Validation horizon in reasoning cycles (informational for deterministic checks). */
    cycles?: number;
    /** Optional distillation dataset for recording shadow verdict labels. */
    distillationDataset?: JudgmentDataset;
}
/** F5: conflict-head consumer — semantic conflict verdict alongside the frequency check. */
export interface ShadowSystemOneDeps {
    adapter: SystemOneLMRuleAdapter;
    /** Reject when a fitted conflict head scores at or above this (unfitted/abstain ⇒ frequency check only). */
    conflictThreshold?: number;
}
/** Result of shadow validation with details for decision-path recording. */
export interface ShadowValidationResult {
    /** Whether the candidate passes validation (no conflict). */
    valid: boolean;
    /** Type of conflict that caused rejection. */
    conflictType?: 'frequency' | 'semantic';
    /** Frequency delta if frequency conflict. */
    frequencyDelta?: number;
    /** Semantic conflict score if semantic conflict. */
    semanticScore?: number;
}
export declare class ShadowValidator {
    #private;
    private readonly maxFrequencyDelta;
    readonly cycles: number;
    constructor(options?: ShadowCheckOptions);
    /** True when the candidate introduces no contradiction with existing beliefs. */
    validate(candidate: BeliefLike, beliefs: readonly BeliefLike[]): ShadowValidationResult;
    /**
     * F5: async validation adding the `conflict` head verdict. The semantic
     * verdict engages only when the head reports `calibration.fitted === true`
     * (Z2 convention — hash scorers are not load-bearing); abstain or unfitted
     * heads fall back to the frequency check. Records the combined verdict.
     */
    validateWithHead(candidate: BeliefLike, beliefs: readonly BeliefLike[]): Promise<ShadowValidationResult>;
    /** Filter a task list, keeping only shadow-valid candidates. */
    validateAll(candidates: readonly BeliefLike[], beliefs: readonly BeliefLike[]): BeliefLike[];
    /** Set the distillation dataset for label recording (for singleton instance). */
    setDistillationDataset(dataset: JudgmentDataset): void;
    /** F5: wire the System One adapter powering the conflict-head verdict. */
    setSystemOne(deps: ShadowSystemOneDeps): void;
}
export declare const shadowValidator: ShadowValidator;
//# sourceMappingURL=shadow-validation.d.ts.map