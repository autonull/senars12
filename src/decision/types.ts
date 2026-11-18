/**
 * The decision layer's vocabulary (TODO29.a §5.11, A11).
 *
 * **Why this is not under `lm/`.** §5.11 asks for the core's decision port to be
 * "typed in the layer's own vocabulary rather than a new one" — which cannot be
 * satisfied from inside `lm/`, because A2's gate resolves the cycle path's imports
 * and a nameable vocabulary is the whole point of the move. The module is a leaf:
 * it depends on `@senars/core` and the term layer, never on a provider, so
 * `core:no-lm` stays satisfied while the *contract* is still the committed one
 * rather than a paraphrase. The `lm/system-one` path re-exports it unchanged, so
 * every existing importer is untouched and there is no second copy.
 */

import { type BudgetLimits, createBudget } from '@senars/core/budget';
import type { ReasoningBudget, SourceQuality } from '@senars/core/schemas';
import type { BandDecision, CognitiveAxis } from '@senars/util';
import type { CriticalityLevel } from '@senars/util/config';
import { z } from 'zod';
import type { ProvisionalStamp } from './provisional-stamp.js';

export type { CriticalityLevel, ReasoningBudget, SourceQuality };

export type BackendId = string & { readonly __brand: 'BackendId' };
export type ModelDigest = string & { readonly __brand: 'ModelDigest' };
export type CalibrationVersion = string & { readonly __brand: 'CalibrationVersion' };
export type QueryId = string & { readonly __brand: 'QueryId' };
export type EmbeddingPointer = number & { readonly __brand: 'EmbeddingPointer' };

export interface EmbeddingCache {
  write(text: string): Promise<EmbeddingPointer>;
  read(pointer: EmbeddingPointer): Float32Array | undefined;
}

export interface JudgmentHead {
  readonly rubric: RubricId | 'classify';
  readonly axis: CognitiveAxis;
  readonly space?: readonly string[];
  readonly levels?: readonly string[];
  /** Heads with trained weights declare fitted=true so consumers may trust scores (B5/Z2). */
  readonly fitted?: boolean;
  evaluate(embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult>;
}

/** Per-level probability weights over an ordered rubric legend, summing to 1. */
export interface ScoreLegend {
  readonly levels: readonly string[];
  readonly weights: readonly number[];
}

/**
 * One option of a head's answer and the mass it carries. The shape every head,
 * every wire format and every proposition reports, so it is named once here: a
 * type and a schema, because the same pair crosses both a compile-time edge and
 * an untrusted one, and a declaration that did not cover both is how a wire
 * format and a type drift into disagreeing about what a distribution is.
 */
export interface ScoreDistribution {
  readonly option: string;
  readonly p: number;
}

export const scoreDistributionSchema = z.object({ option: z.string(), p: z.number() });

/**
 * Why a head declined to answer. Named once so a router that invents a reason
 * declares it here.
 *
 * The union used to name five reasons while the router that decides abstention
 * wrote three more of its own inline — `all-heads-abstained`,
 * `verification-veto` and `no-candidates` — so the majority of the reasons the
 * system actually abstains for were absent from the type meant to hold them, and
 * the two directions of the disjunction (a head abstaining vs. the whole router
 * finding nothing to route to) could not be told apart. All eight are here.
 */
export type AbstainReason =
  | 'low-confidence'
  | 'out-of-domain'
  | 'timeout'
  | 'breaker-open'
  | 'cascade-threshold'
  | 'all-heads-abstained'
  | 'verification-veto'
  | 'no-candidates';

export {
  BANDS,
  COGNITIVE_AXES,
  CognitiveAxisSchema as cognitiveAxisSchema,
  bandOrdinal,
} from '@senars/util';
export type { BandDecision, CognitiveAxis };

export interface HeadResult {
  /** Which rubric judged; absent when the caller already knows. */
  rubric?: RubricId;
  score: number;
  distribution?: readonly ScoreDistribution[];
  legend?: ScoreLegend;
  abstained: boolean;
  abstainReason?: AbstainReason;
  /** The router's band for `score`, once a router has run. */
  decisionBand?: BandDecision;
  axis?: CognitiveAxis;
}

export const RUBRIC_IDS = [
  'ambiguity',
  'relevance',
  'groundedness',
  'novelty',
  'feasibility',
  'conflict',
  'injection',
  'plausibility',
  'assertion',
  'task_type',
  'illocution',
  'tense',
  'source_quality',
  'tool_dispatch',
  'risk',
  'candidate_select',
  'reflex_value',
  'strategy',
  'episodic_match',
] as const;

export type RubricId = (typeof RUBRIC_IDS)[number];

export const rubricIdSchema = z.enum(RUBRIC_IDS);

/** The rubric a name denotes, when it is one of them. A `--head` flag and any other
 *  free-text rubric reaches a caller as a string; the calls that used to cast it
 *  with `as never` also accepted names no head has, and one of them shipped a
 *  default list containing one. */
export const asRubricId = (name: string): RubricId | undefined =>
  (RUBRIC_IDS as readonly string[]).includes(name) ? (name as RubricId) : undefined;

/** Whether a judgment is about what is true or what is wanted. Named once so the
 *  decision contract, the System One wire schema and the config schema cannot each
 *  enumerate the pair on their own. */

export interface ClassifyQuery {
  kind: 'classify';
  instruction: string;
  space: readonly string[];
  axis: CognitiveAxis;
  /** Which classify head judges this query; defaults to `task_type` (Jev
   *  Choice: the query declares its own option space). */
  rubric?: RubricId;
  target?: string;
  criticality?: CriticalityLevel;
}

export interface EvaluateQuery {
  kind: 'evaluate';
  instruction: string;
  rubric: RubricId;
  axis: CognitiveAxis;
  /**
   * What is being evaluated. An `evaluate` head scores *an embedding*, so
   * without a target the query is only meaningful against the shared context —
   * and asking the same context N times yields the same N answers.
   *
   * `ClassifyQuery` already had `target`; this is the same field on the other
   * query kind, so a caller can name a specific candidate in both. TODO32 M2
   * needs it: egress judging asks about *this* derived conclusion, not about
   * whatever the ambient context happens to embed.
   */
  target?: string;
  levels?: readonly string[];
  criticality?: CriticalityLevel;
}

export type JudgmentQuery = ClassifyQuery | EvaluateQuery;

export interface SynthesisQuery {
  kind: 'synthesize';
  instruction: string;
  grammar?: string;
  maxCandidates?: number;
  /** Fully-formed natural-language prompt; bypasses the Top-Beliefs wrapper
   *  (completion-style wrappers degrade small-model decision quality). */
  promptOverride?: string;
}

/** How many candidates a synthesis request proposes when it names no count. */
export const DEFAULT_SYNTHESIS_CANDIDATES = 3;

/** The resolved candidate count for `query` — one default, not one per proposer. */
export const synthesisCandidateCount = (query: SynthesisQuery): number =>
  query.maxCandidates ?? DEFAULT_SYNTHESIS_CANDIDATES;

/**
 * The slot names a synthesis request proposes into: `candidate_1` … `candidate_n`.
 *
 * A candidate that names no slot is an LM proposal the cortex never parsed, and
 * the ladder-tiers, the synthesizer and the stub fallback all have to agree on
 * the spelling for a downstream judge to line a proposal up with the query it
 * answers — they each wrote `candidate_${i + 1}` beside their own loop, and the
 * top-up path numbered by list length instead, so a short parse could repeat a
 * name it already held.
 */
export const candidateSlots = (count: number): string[] =>
  Array.from({ length: Math.max(0, count) }, (_, i) => `candidate_${i + 1}`);

/** The slot after `filled` are taken. */
export const nextCandidateSlot = (filled: number): string => `candidate_${filled + 1}`;

export interface ResourceCost {
  tokensIn: number;
  tokensOut: number;
  computeMs: number;
  memoryMb: number;
}

/** The untrusted-boundary twin of {@link ResourceCost}; the two must not drift. */
export const resourceCostSchema = z.object({
  tokensIn: z.number(),
  tokensOut: z.number(),
  computeMs: z.number(),
  memoryMb: z.number(),
});

/**
 * A cost of nothing, for the paths where a head is local or declined and the
 * spend ledger still wants a row. Spelled as one constant because the literal
 * has four fields and appears on every such path; a site that remembered three
 * of them was a type error only until a field was added.
 */
export const NO_COST: ResourceCost = Object.freeze({
  tokensIn: 0,
  tokensOut: 0,
  computeMs: 0,
  memoryMb: 0,
});

export interface Calibration {
  version: CalibrationVersion;
  ece: number;
  fitted?: boolean;
}

export interface PropositionBase {
  queryId: QueryId;
  backendId: BackendId;
  modelDigest: ModelDigest;
  calibration: Calibration;
  latencyMs: number;
  cost: ResourceCost;
  tier: 0 | 1 | 2 | 3;
  abstained: boolean;
  abstainReason?: AbstainReason;
}

export interface ClassifyProposition extends PropositionBase {
  kind: 'classify';
  axis: CognitiveAxis;
  distribution: readonly ScoreDistribution[];
  top: ScoreDistribution;
  entropy: number;
}

export interface EvaluateProposition extends PropositionBase {
  kind: 'evaluate';
  axis: CognitiveAxis;
  score: number;
  /** Jev-Score semantics (open technique): per-level probability weights over
   *  the ordered rubric legend, probability-weighted around the scalar score. */
  legend?: ScoreLegend;
}

export type JudgmentProposition = ClassifyProposition | EvaluateProposition;

export interface SynthesisProposition {
  kind: 'synthesize';
  candidates: readonly string[];
  cost: ResourceCost;
}

export interface ConsensusResult {
  proposition: JudgmentProposition;
  agreement: number;
  independent: boolean;
}

export interface ManifoldHealth {
  backendId: BackendId;
  ready: boolean;
  breakerOpen: boolean;
  rollingEce: number;
  queueDepth: number;
}

export interface CortexHealth {
  provider: string;
  breakerOpen: boolean;
}

export interface JudgmentManifold {
  judgeBatch(
    sharedContext: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    budget: ReasoningBudget
  ): Promise<JudgmentProposition[]>;

  consensus(
    sharedContext: EmbeddingPointer,
    query: JudgmentQuery,
    k: number,
    budget: ReasoningBudget
  ): Promise<ConsensusResult>;

  health(): ManifoldHealth;
}

export interface GenerativeCortex {
  synthesize(
    context: CognitiveContext,
    query: SynthesisQuery,
    budget: ReasoningBudget
  ): AsyncGenerator<SynthesisProposition>;

  health(): CortexHealth;
}

export interface CognitiveContext {
  topBeliefs: string[];
  topGoals: string[];
  workingMemory: string[];
  tickId: string;
}

export interface CognitiveDispatcher {
  judge(
    sharedContext: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    budget: ReasoningBudget
  ): Promise<JudgmentProposition[]>;

  synthesize(
    context: CognitiveContext,
    query: SynthesisQuery,
    budget: ReasoningBudget
  ): AsyncGenerator<SynthesisProposition>;

  proposeAndJudge(
    context: CognitiveContext,
    synthesisQuery: SynthesisQuery,
    judgmentQueries: readonly JudgmentQuery[],
    budget: ReasoningBudget
  ): Promise<PEAResult>;

  /** Diagnostic introspection (Phase F, audit M4) — optional surface for CLI status. */
  describe?(): {
    enabled: boolean;
    provisional: { cInitial: number; decayRate: number; maxTtlMs: number };
    cortexProvider: string;
    cortexBreakerOpen: boolean;
  };
}

export interface PEAResult {
  candidates: readonly string[];
  judgments: readonly JudgmentProposition[];
  ranked: readonly { candidate: string; truth: import('../terms/impls/Truth.js').Truth }[];
  admitted: readonly {
    candidate: string;
    truth: import('../terms/impls/Truth.js').Truth;
    stamp: import('../terms/impls/Stamp.js').Stamp;
  }[];
  provisional: readonly { candidate: string; provisional: ProvisionalStamp }[];
}

/** Defaults for a System One judgment pass: one judge, no derivation fan-out. */
export const SYSTEM_ONE_BUDGET_DEFAULTS = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
} as const satisfies BudgetLimits;

/**
 * Fresh System One budget. A factory, not a shared constant: budget consumers
 * mutate `consumed` in place, so every call site must own its own object.
 */
export const createSystemOneBudget = (): ReasoningBudget =>
  createBudget(SYSTEM_ONE_BUDGET_DEFAULTS);
