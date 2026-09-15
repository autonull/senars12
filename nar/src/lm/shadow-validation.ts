/**
 * Shadow validation (TODO13 3.3): LLM-generated Narsese tasks are checked
 * against the current belief set before admission. A candidate that produces a
 * contradiction (same term, divergent frequency) is silently dropped and the
 * rule's symbolic fallback stands.
 */
import type { Term, Truth } from '../terms';
import type { Task } from '../types';

export interface BeliefLike {
  term: Term;
  truth?: Truth;
}

export interface ShadowCheckOptions {
  /** Maximum frequency divergence tolerated before the candidate is rejected. */
  maxFrequencyDelta?: number;
  /** Validation horizon in reasoning cycles (informational for deterministic checks). */
  cycles?: number;
}

const DEFAULTS: Required<ShadowCheckOptions> = { maxFrequencyDelta: 0.3, cycles: 3 };

export class ShadowValidator {
  private readonly maxFrequencyDelta: number;
  readonly cycles: number;

  constructor(options: ShadowCheckOptions = {}) {
    const { maxFrequencyDelta, cycles } = { ...DEFAULTS, ...options };
    this.maxFrequencyDelta = maxFrequencyDelta;
    this.cycles = cycles;
  }

  /** True when the candidate introduces no contradiction with existing beliefs. */
  validate(candidate: BeliefLike, beliefs: readonly BeliefLike[]): boolean {
    if (!candidate.truth) return true;
    return !beliefs.some(
      (b) =>
        b.truth &&
        b.term.toString() === candidate.term.toString() &&
        Math.abs(b.truth.f - candidate.truth!.f) > this.maxFrequencyDelta
    );
  }

  /** Filter a task list, keeping only shadow-valid candidates. */
  validateAll(candidates: readonly BeliefLike[], beliefs: readonly BeliefLike[]): BeliefLike[] {
    return candidates.filter((t) => this.validate(t, beliefs));
  }
}

export const shadowValidator = new ShadowValidator();
