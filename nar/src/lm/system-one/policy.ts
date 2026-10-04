/**
 * Jev-inspired decision-API utilities (§0.4, Phase E):
 * `truthProbability` (probability-of-truth — Jev `Noul`), `ConfidenceRouter` (act/review/block bands),
 * `compositeScore` (normalized weighted aggregation), `judgeCascade`
 * (two-stage dependency). Code owns composition — weights are declared, never learned.
 */
import { assertDefined, renormalize, sumBy } from '@senars/util';
import { HEAD_SPECS } from './head-ontology.js';
import type {
  EmbeddingPointer,
  EvaluateProposition,
  EvaluateQuery,
  JudgmentProposition,
  JudgmentQuery,
  ReasoningBudget,
} from './types.js';

/** Jev `Noul`: an Evaluate over the boolean anchor pair, read off the head that owns it. */
export function truthProbability(statement: string): EvaluateQuery {
  const { rubric, axis, levels } = HEAD_SPECS.plausibility;
  return {
    kind: 'evaluate',
    rubric,
    axis,
    levels,
    instruction: `Probability the statement is true: ${statement}`,
  };
}

/** Extracts P(true) from a `truthProbability` proposition; undefined when it abstained. */
export function truthProbabilityOf(p: EvaluateProposition): number | undefined {
  return p.abstained ? undefined : p.score;
}

export type BandDecision = 'act' | 'review' | 'block' | 'abstain';

const BAND_ORDER = { act: 2, review: 1, block: 0 } as const;

export interface ConfidenceBands {
  /** p ≥ act ⇒ act */
  readonly act: number;
  /** review ≤ p < act ⇒ review */
  readonly review: number;
  /** p < review ⇒ block */
  readonly block: number;
}

/** The routing bands a router gets when nothing else says: `act` is the top rung, so
 *  it is also the threshold at which a decision is no longer in doubt — which is why
 *  the decider's safety-floor short-circuit and the pipeline's band table both read
 *  it rather than restating a number. */
export const DEFAULT_CONFIDENCE_BANDS: ConfidenceBands = { act: 0.8, review: 0.5, block: 0 };

/** Monotone band routing: p ≥ act → act; p ≥ review → review; else block. */
export function routeConfidence(
  p: number,
  bands: ConfidenceBands
): Exclude<BandDecision, 'abstain'> {
  if (p >= bands.act) return 'act';
  if (p >= bands.review) return 'review';
  return 'block';
}

/** True iff `candidate` can only restrict relative to `incumbent` (§6.3 monotonicity). */
export function isRestrictive(candidate: ConfidenceBands, incumbent: ConfidenceBands): boolean {
  return (
    candidate.act >= incumbent.act &&
    candidate.review >= incumbent.review &&
    candidate.block >= incumbent.block
  );
}

/** Ordinal position of a band; `abstain` sorts below `block` so abstain is always most restrictive. */
export function bandOrdinal(d: BandDecision): number {
  return d === 'abstain' ? -1 : BAND_ORDER[d];
}

/**
 * Confidence-gated routing (Jev pattern): maps calibrated confidence to
 * act/review/block bands. A router may only restrict — never promote a
 * proposition past a looser router's decision.
 */
export class ConfidenceRouter {
  readonly bands: ConfidenceBands;

  constructor(bands: ConfidenceBands) {
    this.bands = bands;
  }

  /** Default router equivalent to the legacy bare-`p < τ` split (block never fires). */
  static fromThreshold(threshold: number): ConfidenceRouter {
    return new ConfidenceRouter({ act: threshold, review: 0, block: 0 });
  }

  route(
    input: { abstained?: boolean; score?: number; top?: { p: number } } | number
  ): BandDecision {
    if (typeof input === 'number') return routeConfidence(input, this.bands);
    if (input.abstained) return 'abstain';
    return routeConfidence(input.top?.p ?? input.score ?? 0, this.bands);
  }

  /** A stricter router never produces a higher band than a looser one at any p. */
  static monotoneOver(a: ConfidenceRouter, b: ConfidenceRouter, samples = 101): boolean {
    for (let i = 0; i < samples; i++) {
      const p = i / (samples - 1);
      if (bandOrdinal(a.route(p)) > bandOrdinal(b.route(p))) return false;
    }
    return true;
  }
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
export function compositeScore(
  entries: readonly CompositeEntry[],
  weights: Record<string, number>
): CompositeScore | undefined {
  const contributions = renormalize<CompositeEntry, CompositeContribution>(
    entries.filter((e) => !e.abstained),
    (e) => weights[e.key] ?? 0,
    (e, weight) => ({ key: e.key, weight, p: e.p }),
    []
  );
  if (!contributions.length) return undefined;
  return { score: sumBy(contributions, (c) => c.weight * c.p), contributions };
}

export interface CascadeJudge {
  judgeBatch(
    sharedContext: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    budget: ReasoningBudget
  ): Promise<JudgmentProposition[]>;
}

export interface CascadeResult {
  stage1: JudgmentProposition;
  stage2?: JudgmentProposition;
}

/**
 * Two-stage dependency / hierarchical classification (Jev pattern): stage-2's
 * query space is derived from stage-1's resolved top.
 */
export async function judgeCascade(
  judge: CascadeJudge,
  sharedContext: EmbeddingPointer,
  stage1: JudgmentQuery,
  stage2Factory: (stage1: JudgmentProposition) => JudgmentQuery | undefined,
  budget: ReasoningBudget
): Promise<CascadeResult> {
  const [first] = await judge.judgeBatch(sharedContext, [stage1], budget);
  const stage1Result = assertDefined(first, 'judgeCascade: stage-1 produced no proposition');
  const stage2 = stage2Factory(stage1Result);
  if (!stage2) return { stage1: stage1Result };
  const [second] = await judge.judgeBatch(sharedContext, [stage2], budget);
  return { stage1: stage1Result, stage2: second };
}
