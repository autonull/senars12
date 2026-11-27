/**
 * Shadow validation (TODO13 3.3): LLM-generated Narsese tasks are checked
 * against the current belief set before admission. A candidate that produces a
 * contradiction (same term, divergent frequency) is silently dropped and the
 * rule's symbolic fallback stands.
 */
import { recordShadowVerdictLabel } from '../lm/system-one/label-sources';
import { termsEqual } from '../terms';
const DEFAULTS = {
    maxFrequencyDelta: 0.3,
    cycles: 3,
    distillationDataset: undefined,
    conflictThreshold: 0.6,
};
export class ShadowValidator {
    maxFrequencyDelta;
    cycles;
    #dataset;
    #systemOne;
    constructor(options = {}) {
        const { maxFrequencyDelta, cycles, distillationDataset } = { ...DEFAULTS, ...options };
        this.maxFrequencyDelta = maxFrequencyDelta;
        this.cycles = cycles;
        this.#dataset = distillationDataset;
    }
    /** True when the candidate introduces no contradiction with existing beliefs. */
    validate(candidate, beliefs) {
        if (!candidate.truth)
            return { valid: true };
        const sameTerm = (b) => termsEqual(b.term, candidate.term);
        const hasConflict = beliefs.some((b) => b.truth && sameTerm(b) && Math.abs(b.truth.f - candidate.truth.f) > this.maxFrequencyDelta);
        let frequencyDelta;
        if (hasConflict) {
            const existingBelief = beliefs.find((b) => b.truth && sameTerm(b));
            if (existingBelief?.truth) {
                frequencyDelta = Math.abs(existingBelief.truth.f - candidate.truth.f);
            }
        }
        // R7: Record shadow verdict label for distillation
        if (this.#dataset) {
            recordShadowVerdictLabel(this.#dataset, {
                derivationId: candidate.term.toString(),
                verdict: hasConflict ? 'conflict' : 'support',
            });
        }
        return {
            valid: !hasConflict,
            conflictType: hasConflict ? 'frequency' : undefined,
            frequencyDelta,
        };
    }
    /**
     * F5: async validation adding the `conflict` head verdict. The semantic
     * verdict engages only when the head reports `calibration.fitted === true`
     * (Z2 convention — hash scorers are not load-bearing); abstain or unfitted
     * heads fall back to the frequency check. Records the combined verdict.
     */
    async validateWithHead(candidate, beliefs) {
        const frequencyResult = this.validate(candidate, beliefs);
        if (!this.#systemOne || !frequencyResult.valid)
            return frequencyResult;
        const verdict = await this.#systemOne.adapter.conflictScore(candidate.term.toString());
        if (!verdict || verdict.abstained || !verdict.fitted)
            return frequencyResult;
        const semanticConflict = verdict.score >= (this.#systemOne.conflictThreshold ?? DEFAULTS.conflictThreshold);
        if (this.#dataset) {
            recordShadowVerdictLabel(this.#dataset, {
                derivationId: candidate.term.toString(),
                verdict: semanticConflict ? 'conflict' : 'support',
            });
        }
        return {
            valid: !semanticConflict,
            conflictType: semanticConflict ? 'semantic' : undefined,
            semanticScore: semanticConflict ? verdict.score : undefined,
        };
    }
    /** Filter a task list, keeping only shadow-valid candidates. */
    validateAll(candidates, beliefs) {
        return candidates.filter((t) => this.validate(t, beliefs).valid);
    }
    /** Set the distillation dataset for label recording (for singleton instance). */
    setDistillationDataset(dataset) {
        this.#dataset = dataset;
    }
    /** F5: wire the System One adapter powering the conflict-head verdict. */
    setSystemOne(deps) {
        this.#systemOne = deps;
    }
}
export const shadowValidator = new ShadowValidator();
