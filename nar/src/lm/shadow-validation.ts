/**
 * Shadow validation (TODO13 3.3): LLM-generated Narsese tasks are checked
 * against the current belief set before admission. A candidate that produces a
 * contradiction (same term, divergent frequency) is silently dropped and the
 * rule's symbolic fallback stands.
 */
import type { Term, Truth } from '../terms';
import type { JudgmentDataset } from '../lm/system-one/distill.js';
import type { SystemOneLMRuleAdapter } from '../lm/system-one/rule-adapter.js';
import { recordShadowVerdictLabel } from '../lm/system-one/label-sources.js';

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

const DEFAULTS = {
  maxFrequencyDelta: 0.3,
  cycles: 3,
  distillationDataset: undefined as JudgmentDataset | undefined,
  conflictThreshold: 0.6,
};

export class ShadowValidator {
  private readonly maxFrequencyDelta: number;
  readonly cycles: number;
  #dataset?: JudgmentDataset;
  #systemOne?: ShadowSystemOneDeps;

  constructor(options: ShadowCheckOptions = {}) {
    const { maxFrequencyDelta, cycles, distillationDataset } = { ...DEFAULTS, ...options };
    this.maxFrequencyDelta = maxFrequencyDelta;
    this.cycles = cycles;
    this.#dataset = distillationDataset;
  }

  /** True when the candidate introduces no contradiction with existing beliefs. */
  validate(candidate: BeliefLike, beliefs: readonly BeliefLike[]): boolean {
    if (!candidate.truth) return true;
    const hasConflict = beliefs.some(
      (b) =>
        b.truth &&
        b.term.toString() === candidate.term.toString() &&
        Math.abs(b.truth.f - candidate.truth!.f) > this.maxFrequencyDelta
    );

    // R7: Record shadow verdict label for distillation
    if (this.#dataset) {
      recordShadowVerdictLabel(this.#dataset, {
        derivationId: candidate.term.toString(),
        verdict: hasConflict ? 'conflict' : 'support',
      });
    }

    return !hasConflict;
  }

  /**
   * F5: async validation adding the `conflict` head verdict. The semantic
   * verdict engages only when the head reports `calibration.fitted === true`
   * (Z2 convention — hash scorers are not load-bearing); abstain or unfitted
   * heads fall back to the frequency check. Records the combined verdict.
   */
  async validateWithHead(candidate: BeliefLike, beliefs: readonly BeliefLike[]): Promise<boolean> {
    const frequencyVerdict = this.validate(candidate, beliefs);
    if (!this.#systemOne || !frequencyVerdict) return frequencyVerdict;

    const verdict = await this.#systemOne.adapter.conflictScore(candidate.term.toString());
    if (!verdict || verdict.abstained || !verdict.fitted) return frequencyVerdict;
    const semanticConflict = verdict.score >= (this.#systemOne.conflictThreshold ?? DEFAULTS.conflictThreshold);
    if (this.#dataset) {
      recordShadowVerdictLabel(this.#dataset, {
        derivationId: candidate.term.toString(),
        verdict: semanticConflict ? 'conflict' : 'support',
      });
    }
    return !semanticConflict;
  }

  /** Filter a task list, keeping only shadow-valid candidates. */
  validateAll(candidates: readonly BeliefLike[], beliefs: readonly BeliefLike[]): BeliefLike[] {
    return candidates.filter((t) => this.validate(t, beliefs));
  }

  /** Set the distillation dataset for label recording (for singleton instance). */
  setDistillationDataset(dataset: JudgmentDataset): void {
    this.#dataset = dataset;
  }

  /** F5: wire the System One adapter powering the conflict-head verdict. */
  setSystemOne(deps: ShadowSystemOneDeps): void {
    this.#systemOne = deps;
  }
}

export const shadowValidator = new ShadowValidator();
