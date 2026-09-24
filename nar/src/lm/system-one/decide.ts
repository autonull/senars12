/**
 * Unified decision API (TODO23): one typed call composing the calibrated-head
 * path (`judgeBatch` → isotonic → `ConfidenceRouter`) with the TODO22
 * contrastive layer. A thin facade — all inference logic lives in the
 * manifold heads, contrastive memory, and policy utilities it composes.
 */
import { createHash } from 'node:crypto';
import { rubricOf, type ContrastiveMemory } from './contrastive.js';
import {
  compositeScore,
  ConfidenceRouter,
  type BandDecision,
  type CompositeScore,
  type ConfidenceBands,
} from './policy.js';
import type {
  EmbeddingCache,
  EmbeddingPointer,
  JudgmentProposition,
  JudgmentQuery,
  ReasoningBudget,
  RubricId,
} from './types.js';

const DEFAULT_BANDS: ConfidenceBands = { act: 0.8, review: 0.5, block: 0 };

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
  abstainReason?: 'all-heads-abstained' | 'out-of-domain';
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

export type TieredJudge = (
  sharedContext: EmbeddingPointer,
  queries: readonly JudgmentQuery[],
  budget: ReasoningBudget
) => Promise<JudgmentProposition[]>;

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

/** Per-head band routing over the router (abstain propagates). */
function verdictBand(
  router: ConfidenceRouter,
  proposition: JudgmentProposition | undefined
): BandDecision {
  if (!proposition) return 'abstain';
  return proposition.kind === 'classify'
    ? router.route({ abstained: proposition.abstained, top: proposition.top })
    : router.route({ abstained: proposition.abstained, score: proposition.score });
}

const BAND_ORDINAL: Record<Exclude<BandDecision, 'abstain'>, number> = { block: 0, review: 1, act: 2 };
const ordinal = (b: BandDecision) => (b === 'abstain' ? -1 : BAND_ORDINAL[b]);

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function contrastiveScore(
  contrastive: ContrastiveMemory | undefined,
  embedding: Float32Array | undefined,
  rubric?: string
): ContrastiveVerdict {
  if (!contrastive || contrastive.isEmpty() || !embedding) return {};
  const score = contrastive.score(embedding, rubric);
  return score === undefined ? {} : { score, penalty: 1 - score };
}

function deriveProvenance(
  propositions: readonly JudgmentProposition[],
  inputDigest: string,
  band: BandDecision,
  abstained: boolean,
  overrides: { modelDigest?: string; calibrationDigest?: string; contrastiveDigest?: string } = {}
): JudgmentProvenance {
  const first = propositions[0];
  return {
    modelDigest: overrides.modelDigest ?? first?.modelDigest,
    calibrationDigest:
      overrides.calibrationDigest ??
      (first ? sha256(`${first.modelDigest}:${first.calibration.version}`) : undefined),
    inputDigest,
    contrastiveDigest: overrides.contrastiveDigest,
    fitted: propositions.some((p) => p.calibration.fitted),
    abstained,
    band,
    timestamp: Date.now(),
  };
}

export function createDecider(deps: DecideDeps): Decider {
  const router = deps.router ?? new ConfidenceRouter(DEFAULT_BANDS);
  const chunkSize = Math.max(1, deps.maxBatchSize ?? 64);

  const decide = async (request: DecideRequest): Promise<DecideResult> => {
    const contextPointer = (await deps.embeddingCache.write(request.context)) as EmbeddingPointer;
    const propositions: JudgmentProposition[] = [];
    for (let i = 0; i < request.queries.length; i += chunkSize) {
      propositions.push(
        ...(await deps.judge(contextPointer, request.queries.slice(i, i + chunkSize), request.budget))
      );
    }

    const embedding = deps.embeddingCache.read(contextPointer);
    const contrastive = contrastiveScore(deps.contrastive, embedding, request.contrastiveRubric);

    const verdicts: HeadVerdict[] = request.queries.map((query, i) => {
      const proposition = propositions[i];
      return {
        query,
        proposition,
        band: verdictBand(router, proposition),
        abstained: proposition?.abstained ?? true,
        abstainReason: proposition?.abstainReason ?? 'out-of-domain',
        skipped: false,
      };
    });

    const nonAbstained = verdicts.filter((v) => !v.abstained);
    const band = verdicts.reduce<BandDecision>(
      (mostRestrictive, v) => (ordinal(v.band) < ordinal(mostRestrictive) ? v.band : mostRestrictive),
      'act'
    );
    const abstained =
      nonAbstained.length === 0 || (contrastive.score !== undefined && contrastive.score < 0.1);
    const abstainReason = nonAbstained.length === 0 ? 'all-heads-abstained' : 'out-of-domain';

    const entries = verdicts.flatMap(({ query, proposition }) => {
      const p = propositionScore(proposition);
      return p === undefined ? [] : [{ key: rubricOf(query), p }];
    });
    const composite =
      request.weights && entries.length > 0
        ? compositeScore(entries.map((e) => ({ ...e, abstained: e.p === undefined })), request.weights)
        : undefined;

    return {
      contextPointer,
      verdicts,
      composite,
      contrastive,
      band,
      abstained,
      abstainReason: abstained ? abstainReason : undefined,
      provenance: deriveProvenance(
        propositions,
        sha256(request.context),
        band,
        abstained,
        deps
      ),
    };
  };

  const choose = async (request: ChooseRequest): Promise<ChooseResult> => {
    const { candidates } = request;
    if (candidates.length === 0) {
      return {
        selected: undefined,
        distribution: [],
        abstained: true,
        abstainReason: 'no-candidates',
        contrastive: { penalties: {}, vetoes: [] },
        provenance: deriveProvenance([], sha256(''), 'abstain', true, deps),
      };
    }

    const contextPointer = (await deps.embeddingCache.write(request.context)) as EmbeddingPointer;
    const query: JudgmentQuery = {
      kind: 'classify',
      instruction: request.instruction ?? 'Select the best option.',
      space: candidates,
      axis: request.axis ?? 'teleological',
      rubric: request.rubric ?? 'candidate_select',
    };
    const [proposition] = await deps.judge(contextPointer, [query], request.budget);

    // Per-candidate contrastive penalties (CLM hard-negative proximity).
    const penalties: Record<string, number> = {};
    const vetoes: string[] = [];
    const floor = request.verificationFloor ?? 0;
    for (const candidate of candidates) {
      try {
        const pointer = (await deps.embeddingCache.write(candidate)) as EmbeddingPointer;
        const verdict = contrastiveScore(deps.contrastive, deps.embeddingCache.read(pointer));
        if (verdict.penalty !== undefined) {
          penalties[candidate] = verdict.penalty;
          if (verdict.score !== undefined && verdict.score < floor) vetoes.push(candidate);
        }
      } catch {
        // Unembeddable candidate — no penalty, no veto
      }
    }

    const distribution = adjustDistribution(proposition, penalties);
    const selected = distribution.find((d) => !vetoes.includes(d.option))?.option;
    const abstained = selected === undefined;
    const band = abstained ? 'abstain' : verdictBand(router, proposition);
    const inputDigest = sha256(candidates.join('\n'));
    const provenance = {
      ...deriveProvenance(proposition ? [proposition] : [], inputDigest, band, abstained, deps),
      inputDigest,
    };
    return {
      selected,
      distribution,
      abstained,
      abstainReason: abstained ? (proposition?.abstained ? 'low-confidence' : 'verification-veto') : undefined,
      contrastive: { penalties, vetoes },
      provenance,
    };
  };

  return { decide, choose };
}

type EvaluatePropositionLike = { abstained: boolean; score: number };

/** Confidence extracted from a proposition; undefined when it abstained. */
function propositionScore(p: JudgmentProposition | undefined): number | undefined {
  if (!p || p.abstained) return undefined;
  return p.kind === 'classify' ? p.top.p : p.score;
}

/** Contrastive-penalized, re-normalized distribution (vetoed candidates stay listed). */
function adjustDistribution(
  proposition: JudgmentProposition | undefined,
  penalties: Record<string, number>
): readonly { option: string; p: number }[] {
  if (!proposition || proposition.kind !== 'classify' || proposition.abstained) return [];
  const adjusted = proposition.distribution.map((d) => ({
    option: d.option,
    p: d.p * (1 - (penalties[d.option] ?? 0)),
  }));
  const total = adjusted.reduce((sum, d) => sum + d.p, 0);
  return total > 0
    ? adjusted.map((d) => ({ ...d, p: d.p / total }))
    : proposition.distribution;
}

export interface ChooseRequest {
  context: string;
  candidates: readonly string[];
  budget: ReasoningBudget;
  instruction?: string;
  rubric?: RubricId;
  axis?: 'epistemic' | 'teleological';
  /** Contrastive score below this vetoes a candidate (0 = no vetoing). */
  verificationFloor?: number;
}

export interface ChooseResult {
  selected?: string;
  distribution: readonly { option: string; p: number }[];
  abstained: boolean;
  abstainReason?: 'low-confidence' | 'verification-veto' | 'no-candidates';
  contrastive: { penalties: Record<string, number>; vetoes: readonly string[] };
  provenance: JudgmentProvenance;
}

