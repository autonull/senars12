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
import type { ProvisionalStamp } from './provisional-stamp.js';

export type { ReasoningBudget, SourceQuality };

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

export interface HeadResult {
  score: number;
  distribution?: readonly { option: string; p: number }[];
  legend?: ScoreLegend;
  abstained: boolean;
  abstainReason?: 'low-confidence' | 'out-of-domain' | 'timeout' | 'breaker-open';
}

export type RubricId =
  | 'ambiguity'
  | 'relevance'
  | 'groundedness'
  | 'novelty'
  | 'feasibility'
  | 'conflict'
  | 'injection'
  | 'plausibility'
  | 'assertion'
  | 'task_type'
  | 'illocution'
  | 'tense'
  | 'source_quality'
  | 'tool_dispatch'
  | 'risk'
  | 'candidate_select'
  | 'reflex_value'
  | 'strategy'
  | 'episodic_match';

export type CognitiveAxis = 'epistemic' | 'teleological';
export type CriticalityLevel = 'low' | 'standard' | 'high' | 'critical';

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

export interface ResourceCost {
  tokensIn: number;
  tokensOut: number;
  computeMs: number;
  memoryMb: number;
}

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
  abstainReason?: 'low-confidence' | 'out-of-domain' | 'timeout' | 'breaker-open';
}

export interface ClassifyProposition extends PropositionBase {
  kind: 'classify';
  axis: CognitiveAxis;
  distribution: readonly { option: string; p: number }[];
  top: { option: string; p: number };
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
