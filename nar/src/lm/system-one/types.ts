import type { ReasoningBudget, SourceQuality } from '@senars/kernel/schemas';

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

export interface HeadResult {
  score: number;
  distribution?: readonly { option: string; p: number }[];
  legend?: { levels: readonly string[]; weights: readonly number[] };
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
  legend?: { levels: readonly string[]; weights: readonly number[] };
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
  ranked: readonly { candidate: string; truth: import('../../terms/truth.js').Truth }[];
  admitted: readonly {
    candidate: string;
    truth: import('../../terms/truth.js').Truth;
    stamp: import('../../terms/stamp.js').Stamp;
  }[];
  provisional: readonly { candidate: string; provisional: ProvisionalStamp }[];
}

export interface ProvisionalStamp {
  kind: 'provisional';
  stamp: import('../../terms/stamp.js').Stamp;
  cInitial: number;
  decayRate: number;
  createdAt: number;
  expiresAt: number;

  confidence(now: number): number;
}
