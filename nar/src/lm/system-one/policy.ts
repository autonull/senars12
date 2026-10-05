/**
 * Jev-inspired decision-API utilities (§0.4, Phase E):
 * `truthProbability` (probability-of-truth — Jev `Noul`), `ConfidenceRouter` (act/review/block bands),
 * `compositeScore` (normalized weighted aggregation), `judgeCascade`
 * (two-stage dependency). Code owns composition — weights are declared, never learned.
 */
import { assertDefined, BANDS, renormalize, sumBy } from '@senars/util';
import { HEAD_SPECS } from './head-ontology.js';
import type {
  BandDecision,
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

/**
 * The decision layer owns the band vocabulary; the router that reads it re-exports.
 * A stricter router can only restrict: `isRestrictive` is the whole test, analytically
 * over the thresholds, so the 101-sample search that used to check it had no callers
 * left once the ladder became one declaration.
 */
export type { BandDecision };

/**
 * The graded rungs, most permissive first: every band but `abstain`, read off `BANDS`
 * in ordinal order rather than written out a fourth time. `abstain` has no threshold
 * because it is the answer when the head declined, not a score that routes to it.
 */
const RUNGS = (Object.entries(BANDS) as [BandDecision, number][])
  .filter((entry): entry is [Rung, number] => entry[0] !== 'abstain')
  .toSorted((a, b) => b[1] - a[1])
  .map(([band]) => band);

type Rung = Exclude<BandDecision, 'abstain'>;

/** One threshold per rung: `p >= rung` routes to `rung`, first match wins, else `block`. */
export type ConfidenceBands = Record<Rung, number>;

/** The routing bands a router gets when nothing else says: `act` is the top rung, so
 *  it is also the threshold at which a decision is no longer in doubt — which is why
 *  the decider's safety-floor short-circuit and the pipeline's band table both read
 *  it rather than restating a number. */
export const DEFAULT_CONFIDENCE_BANDS: ConfidenceBands = { act: 0.8, review: 0.5, block: 0 };

/** Monotone band routing: the first rung whose threshold `p` clears, else `block`. */
export const routeConfidence = (p: number, bands: ConfidenceBands): Rung =>
  RUNGS.find((rung) => p >= bands[rung]) ?? 'block';

/** True iff `candidate` can only restrict relative to `incumbent` (monotonicity). */
export const isRestrictive = (candidate: ConfidenceBands, incumbent: ConfidenceBands): boolean =>
  RUNGS.every((rung) => candidate[rung] >= incumbent[rung]);

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
