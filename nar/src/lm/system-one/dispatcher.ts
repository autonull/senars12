import type {
  ReasoningBudget,
} from '@senars/kernel/schemas';
import { v4 as uuidv4 } from 'uuid';
import type {
  BackendId,
  CalibrationVersion,
  ClassifyProposition,
  ClassifyQuery,
  CognitiveAxis,
  CognitiveContext,
  CognitiveDispatcher,
  ConsensusResult,
  CortexHealth,
  EmbeddingCache,
  EmbeddingPointer,
  EvaluateProposition,
  EvaluateQuery,
  GenerativeCortex,
  JudgmentManifold,
  JudgmentProposition,
  JudgmentQuery,
  ManifoldHealth,
  ModelDigest,
  PEAResult,
  ProvisionalStamp,
  QueryId,
  ResourceCost,
  RubricId,
  SynthesisProposition,
  SynthesisQuery,
} from './types.js';
import { Truth } from '../../terms/truth.js';
import { Stamp } from '../../terms/stamp.js';
import { AlgebraPurityError, validateBatchQueries } from './algebra.js';
import { seedTruth, seedDesire } from './seed.js';
import { createProvisionalStamp } from './provisional-stamp.js';

export class DeterministicManifold implements JudgmentManifold {
  readonly #backendId: BackendId = 'deterministic-tier0' as BackendId;
  readonly #modelDigest: ModelDigest = 'sha256:deterministic' as ModelDigest;
  readonly #calibrationVersion: CalibrationVersion = 'v1.0.0' as CalibrationVersion;

  async judgeBatch(
    _sharedContext: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    _budget: ReasoningBudget
  ): Promise<JudgmentProposition[]> {
    validateBatchQueries(queries);
    return queries.map((q) => this.deterministicJudge(q));
  }

  async consensus(
    _sharedContext: EmbeddingPointer,
    query: JudgmentQuery,
    _k: number,
    _budget: ReasoningBudget
  ): Promise<ConsensusResult> {
    validateBatchQueries([query]);
    const prop = this.deterministicJudge(query);
    return { proposition: prop, agreement: 1.0, independent: true };
  }

  health(): ManifoldHealth {
    return {
      backendId: this.#backendId,
      ready: true,
      breakerOpen: false,
      rollingEce: 0.0,
      queueDepth: 0,
    };
  }

  private deterministicJudge(query: JudgmentQuery): JudgmentProposition {
    const queryId = uuidv4() as QueryId;
    const base: Omit<JudgmentProposition, 'kind' | 'axis' | 'distribution' | 'top' | 'entropy' | 'score'> = {
      queryId,
      backendId: this.#backendId,
      modelDigest: this.#modelDigest,
      calibration: { version: this.#calibrationVersion, ece: 0.0 },
      latencyMs: 0,
      cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
      tier: 0,
      abstained: false,
    };

    if (query.kind === 'classify') {
      const space = query.space;
      const topOption = space[0] ?? 'unknown';
      const dist = space.map((opt, i) => ({ option: opt, p: i === 0 ? 1.0 : 0.0 }));
      return {
        ...base,
        kind: 'classify',
        axis: query.axis,
        distribution: dist,
        top: { option: topOption, p: 1.0 },
        entropy: 0.0,
      };
    } else {
      return {
        ...base,
        kind: 'evaluate',
        axis: query.axis,
        score: 0.5,
      };
    }
  }
}

export class StubCortex implements GenerativeCortex {
  readonly #provider: string;

  constructor(provider: string = 'off') {
    this.#provider = provider;
  }

  async *synthesize(
    _context: CognitiveContext,
    query: SynthesisQuery,
    _budget: ReasoningBudget
  ): AsyncGenerator<SynthesisProposition> {
    const candidates = query.maxCandidates ?? 3;
    const cands = Array.from({ length: candidates }, (_, i) => `candidate_${i + 1}`);
    yield {
      kind: 'synthesize',
      candidates: cands,
      cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
    };
  }

  health(): CortexHealth {
    return { provider: this.#provider, breakerOpen: this.#provider === 'off' };
  }
}

export class Tier3SymbolicManifold implements JudgmentManifold {
  readonly #backendId: BackendId = 'symbolic-tier3' as BackendId;
  readonly #modelDigest: ModelDigest = 'sha256:symbolic' as ModelDigest;
  readonly #calibrationVersion: CalibrationVersion = 'v1.0.0' as CalibrationVersion;

  async judgeBatch(
    _sharedContext: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    _budget: ReasoningBudget
  ): Promise<JudgmentProposition[]> {
    validateBatchQueries(queries);
    return queries.map((q) => this.symbolicJudge(q));
  }

  async consensus(
    _sharedContext: EmbeddingPointer,
    query: JudgmentQuery,
    _k: number,
    _budget: ReasoningBudget
  ): Promise<ConsensusResult> {
    validateBatchQueries([query]);
    const prop = this.symbolicJudge(query);
    return { proposition: prop, agreement: 1.0, independent: true };
  }

  health(): ManifoldHealth {
    return {
      backendId: this.#backendId,
      ready: true,
      breakerOpen: false,
      rollingEce: 0.05,
      queueDepth: 0,
    };
  }

  private symbolicJudge(query: JudgmentQuery): JudgmentProposition {
    const queryId = uuidv4() as QueryId;
    const base: Omit<JudgmentProposition, 'kind' | 'axis' | 'distribution' | 'top' | 'entropy' | 'score'> = {
      queryId,
      backendId: this.#backendId,
      modelDigest: this.#modelDigest,
      calibration: { version: this.#calibrationVersion, ece: 0.05 },
      latencyMs: 1,
      cost: { tokensIn: 0, tokensOut: 0, computeMs: 1, memoryMb: 0 },
      tier: 3,
      abstained: false,
    };

    if (query.kind === 'classify') {
      const space = query.space;
      const topOption = space[0] ?? 'unknown';
      const dist = space.map((opt, i) => ({ option: opt, p: i === 0 ? 0.8 : 0.2 / Math.max(1, space.length - 1) }));
      return {
        ...base,
        kind: 'classify',
        axis: query.axis,
        distribution: dist,
        top: { option: topOption, p: 0.8 },
        entropy: 0.5,
      };
    } else {
      return {
        ...base,
        kind: 'evaluate',
        axis: query.axis,
        score: 0.5,
      };
    }
  }
}

/**
 * Four-tier judgment ladder:
 * Tier 0: Deterministic (parser, Zod, MeTTa, regex) - ALWAYS FIRST
 * Tier 1: Manifold (encoder heads) - when enabled
 * Tier 2: Cortex (LMService decoders) - for synthesis only
 * Tier 3: Symbolic (NAL RuleProcessor) - final fallback
 */
export interface DispatcherOptions {
  embeddingCache?: EmbeddingCache;
  /** Real Tier 1 manifold; defaults to a deterministic stub when omitted. */
  tier1Manifold?: JudgmentManifold;
  provisional?: { cInitial: number; decayRate: number; maxTtlMs: number };
}

export class SystemOneDispatcher implements CognitiveDispatcher {
  #tier0: JudgmentManifold;
  tier1: JudgmentManifold | null; // public for test injection
  #tier3: JudgmentManifold;
  #cortex: GenerativeCortex;
  #enabled: boolean;
  #embeddingCache: EmbeddingCache | null;
  #provisional: { cInitial: number; decayRate: number; maxTtlMs: number };

  constructor(
    tier0: JudgmentManifold,
    tier1: JudgmentManifold | null,
    tier3: JudgmentManifold,
    cortex: GenerativeCortex,
    enabled: boolean,
    options: DispatcherOptions = {}
  ) {
    this.#tier0 = tier0;
    this.tier1 = tier1;
    this.#tier3 = tier3;
    this.#cortex = cortex;
    this.#enabled = enabled;
    this.#embeddingCache = options.embeddingCache ?? null;
    this.#provisional = options.provisional ?? { cInitial: 0.1, decayRate: 0.3, maxTtlMs: 30_000 };
  }

  async judge(
    sharedContext: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    budget: ReasoningBudget
  ): Promise<JudgmentProposition[]> {
    validateBatchQueries(queries);

    // Tier 0: Always runs first (deterministic checks)
    const tier0Results = await this.#tier0.judgeBatch(sharedContext, queries, budget);

    // If System One is disabled or Tier 1 unavailable, return Tier 0 results
    if (!this.#enabled || !this.tier1) {
      return tier0Results;
    }

    // Tier 1: Manifold (encoder heads)
    try {
      const tier1Results = await this.tier1.judgeBatch(sharedContext, queries, budget);
      // Use Tier 1 results when available and confident
      return tier1Results.map((r, i) => {
        const tier0Result = tier0Results[i];
        const query = queries[i];

        // R6: Explicit safety floor — queries with criticality ∈ {high, critical}
        // and rubric ∈ {injection, assertion} that abstain MUST fail closed.
        // They never fall back to Tier 0 defaults.
        const isSafetyFloorQuery =
          query &&
          (query.criticality === 'high' || query.criticality === 'critical') &&
          query.kind === 'evaluate' &&
          (query.rubric === 'injection' || query.rubric === 'assertion');

        if (isSafetyFloorQuery && r.abstained) {
          // Return a hard-veto proposition: score > threshold triggers veto
          const vetoScore = 0.99;
          return {
            ...r,
            score: vetoScore,
            abstained: false,
            tier: 1,
          } as any;
        }

        return r.abstained || (r.kind === 'classify' && r.top.p < 0.5) ? tier0Result! : r;
      });
    } catch {
      // Tier 1 failed, fall through to Tier 3
      // But safety-floor queries still fail closed
      const tier3Results = await this.#tier3.judgeBatch(sharedContext, queries, budget);
      return tier3Results.map((r, i) => {
        const query = queries[i];
        const isSafetyFloorQuery =
          query &&
          (query.criticality === 'high' || query.criticality === 'critical') &&
          query.kind === 'evaluate' &&
          (query.rubric === 'injection' || query.rubric === 'assertion');

        if (isSafetyFloorQuery) {
          // Return a hard-veto proposition: score > threshold triggers veto
          return {
            ...r,
            score: 0.99,
            abstained: false,
            tier: 1,
          } as any;
        }
        return r;
      });
    }
  }

  async *synthesize(
    context: CognitiveContext,
    query: SynthesisQuery,
    budget: ReasoningBudget
  ): AsyncGenerator<SynthesisProposition> {
    if (!this.#enabled) {
      yield* this.#cortex.synthesize(context, query, budget);
      return;
    }
    try {
      yield* this.#cortex.synthesize(context, query, budget);
    } catch {
      yield* this.#cortex.synthesize(context, query, budget);
    }
  }

  async #resolveContextPointer(context: CognitiveContext): Promise<EmbeddingPointer> {
    if (!this.#embeddingCache) return 0 as EmbeddingPointer;
    const text = context.topBeliefs.length > 0 ? context.topBeliefs.join(' ') : context.tickId;
    return this.#embeddingCache.write(text);
  }

  async proposeAndJudge(
    context: CognitiveContext,
    synthesisQuery: SynthesisQuery,
    judgmentQueries: readonly JudgmentQuery[],
    budget: ReasoningBudget
  ): Promise<PEAResult> {
    const candidates: string[] = [];
    const seen = new Set<string>();
    for await (const synth of this.synthesize(context, synthesisQuery, budget)) {
      for (const c of synth.candidates) {
        if (!seen.has(c)) {
          seen.add(c);
          candidates.push(c);
        }
      }
    }

    const selectQuery: ClassifyQuery | undefined = candidates.length
      ? {
          kind: 'classify',
          instruction: synthesisQuery.instruction,
          space: candidates,
          axis: 'teleological',
          criticality: 'standard',
        }
      : undefined;
    const conflictQuery: EvaluateQuery = {
      kind: 'evaluate',
      instruction: 'Evaluate conflict between candidates and current beliefs',
      rubric: 'conflict',
      axis: 'epistemic',
      criticality: 'standard',
    };
    const queries: readonly JudgmentQuery[] = selectQuery ? [selectQuery, ...judgmentQueries] : judgmentQueries;

    const sharedContext = await this.#resolveContextPointer(context);
    let judgments: JudgmentProposition[];
    let manifoldFailed = false;
    try {
      judgments = await this.judge(sharedContext, queries, budget);
    } catch {
      judgments = await this.#tier0.judgeBatch(sharedContext, queries, budget);
      manifoldFailed = true;
    }

    const select = selectQuery
      ? judgments.find((j) => j.kind === 'classify' && j.axis === 'teleological')
      : undefined;
    // Manifold-validated only (tier 1): Tier 0/3 fallbacks carry no calibrated authority,
    // so their output is admitted provisionally (§6.4).
    const selectUsable =
      select && !select.abstained && select.kind === 'classify' && (select as ClassifyProposition).tier === 1;

    // R5: Per-candidate embeddings — write each candidate to cache and evaluate individually
    // so ranking discriminates content, not just context.
    let ranking: readonly { option: string; p: number }[] | undefined;
    if (selectUsable && selectQuery && this.#embeddingCache) {
      const candidateEmbeddings: EmbeddingPointer[] = [];
      for (const candidate of candidates) {
        const pointer = await this.#embeddingCache.write(candidate);
        candidateEmbeddings.push(pointer);
      }
      // Re-judge candidate_select with per-candidate embeddings
      const perCandidateQueries: ClassifyQuery[] = candidates.map((c) => ({
        kind: 'classify' as const,
        instruction: `Evaluate candidate: ${c}`,
        space: selectQuery.space,
        axis: 'teleological' as const,
        criticality: 'standard' as const,
      }));
      const candidateJudgments = await this.judge(sharedContext, perCandidateQueries, budget);
      ranking = candidates.map((c, i) => ({
        option: c,
        p: (candidateJudgments[i] as ClassifyProposition).top.p,
      }));
    } else {
      ranking = selectUsable ? (select as ClassifyProposition).distribution : undefined;
    }

    const ranked = candidates.map((candidate) => {
      if (ranking) {
        const p = ranking.find((d) => d.option === candidate)?.p ?? 0;
        const authority = selectUsable ? seedTruth(select as ClassifyProposition).c : 0;
        return { candidate, truth: Truth.create(p, authority) };
      }
      return { candidate, truth: Truth.NEUTRAL };
    });
    ranked.sort((a, b) => b.truth.f - a.truth.f);

    const provisional = [];
    const admitted = [];
    const needsProvisional = manifoldFailed || !selectUsable;
    for (const { candidate, truth } of ranked) {
      if (needsProvisional) {
        const stamp = createProvisionalStamp(
          Stamp.createWithSource('LM'),
          this.#provisional.cInitial,
          this.#provisional.decayRate,
          this.#provisional.maxTtlMs
        );
        provisional.push({ candidate, provisional: stamp });
      } else {
        admitted.push({ candidate, truth, stamp: Stamp.createWithSource('LM') });
      }
    }

    return { candidates, judgments, ranked, admitted, provisional };
  }
}

export function createDispatcher(enabled = false, options: DispatcherOptions = {}): CognitiveDispatcher {
  const tier0 = new DeterministicManifold();
  const tier1 = enabled ? options.tier1Manifold ?? new DeterministicManifold() : null;
  const tier3 = new Tier3SymbolicManifold();
  const cortex = new StubCortex('off');
  return new SystemOneDispatcher(tier0, tier1, tier3, cortex, enabled, options);
}