import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { KernelBudgetGate } from '../../kernel/KernelBudgetGate.js';
import { Stamp } from '../../terms/stamp.js';
import { Truth } from '../../terms/truth.js';
import { validateBatchQueries } from './algebra.js';
import type { ContrastiveMemory } from './contrastive.js';
import { DeterministicManifold, Tier3SymbolicManifold } from './constant-manifold.js';
import { selectQuery as buildSelectQuery } from './head-specs.js';
import { compositeScore } from './policy.js';
import { createProvisionalStamp } from './provisional-stamp.js';
import { assertCostReported, chargeJudgment, resourceCostToLmCalls } from './resource-gate.js';
import { seedTruth } from './seed.js';
import type {
  ClassifyProposition,
  CognitiveContext,
  CognitiveDispatcher,
  CortexHealth,
  EmbeddingCache,
  EmbeddingPointer,
  EvaluateProposition,
  GenerativeCortex,
  JudgmentManifold,
  JudgmentProposition,
  JudgmentQuery,
  PEAResult,
  RubricId,
  SynthesisProposition,
  SynthesisQuery,
} from './types.js';

export { DeterministicManifold, Tier3SymbolicManifold };

export class StubCortex implements GenerativeCortex {
  readonly #provider: string;
  /** True when the stub is a placeholder (no generative backend behind it). */
  readonly isPlaceholder: boolean;

  constructor(provider: string = 'off', isPlaceholder = provider === 'off') {
    this.#provider = provider;
    this.isPlaceholder = isPlaceholder;
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
  /** E2: declared (never learned) weights for composite ranking. Any key beyond
   *  `candidate_select` adds a per-candidate judgment query (currently `feasibility`). */
  rankingWeights?: Record<string, number>;
  /** B7/X8: flow-level accounting — `judge` charges `systemone-judgment` per batch
   *  (max proposition cost); a denied scope yields no Tier-1 propositions. */
  budgetGate?: KernelBudgetGate;
  budgetScopeId?: string;
  /** CLM contrastive routing: penalize candidates near stored hard negatives,
   *  and gate proposeAndJudge on in-domain-ness (OOD ⇒ provisional only). */
  contrastive?: ContrastiveMemory;
}

export class SystemOneDispatcher implements CognitiveDispatcher {
  #tier0: JudgmentManifold;
  tier1: JudgmentManifold | null; // public for test injection
  #tier3: JudgmentManifold;
  #cortex: GenerativeCortex;
  #enabled: boolean;
  #embeddingCache: EmbeddingCache | null;
  #provisional: { cInitial: number; decayRate: number; maxTtlMs: number };
  #rankingWeights: Record<string, number>;
  #budgetGate: KernelBudgetGate | null;
  #budgetScopeId: string;
  #contrastive: ContrastiveMemory | null;

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
    this.#rankingWeights = options.rankingWeights ?? { candidate_select: 1 };
    this.#budgetGate = options.budgetGate ?? null;
    this.#budgetScopeId = options.budgetScopeId ?? 'default';
    this.#contrastive = options.contrastive ?? null;
  }

  /**
   * Diagnostic introspection (Phase F, audit M4): the CLI status surface needs
   * private-config facts (provisional cache, cortex identity) without the
   * invalid `?.#field` chains bot.ts previously reached through.
   */
  describe(): {
    enabled: boolean;
    provisional: { cInitial: number; decayRate: number; maxTtlMs: number };
    cortexProvider: string;
    cortexBreakerOpen: boolean;
  } {
    const health = this.#cortex.health?.();
    return {
      enabled: this.#enabled,
      provisional: { ...this.#provisional },
      cortexProvider: health?.provider ?? 'off',
      cortexBreakerOpen: health?.breakerOpen ?? true,
    };
  }

  async judge(
    sharedContext: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    budget: ReasoningBudget
  ): Promise<JudgmentProposition[]> {
    validateBatchQueries(queries);

    // Tier 0: Always runs first (deterministic checks)
    const t0Start = performance.now();
    const tier0Results = await this.#tier0.judgeBatch(sharedContext, queries, budget);
    this.#recordLatency(0, t0Start, tier0Results.length);

    // If System One is disabled or Tier 1 unavailable, return Tier 0 results
    if (!this.#enabled || !this.tier1) {
      return tier0Results;
    }

    // Tier 1: Manifold (encoder heads)
    try {
      const t1Start = performance.now();
      const tier1Results = await this.tier1.judgeBatch(sharedContext, queries, budget);
      this.#recordLatency(1, t1Start, tier1Results.length);
      // Use Tier 1 results when available and confident
      const mapped = tier1Results.map((r, i) => {
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

      // B7/X8: charge the batch (max proposition cost) against the kernel BudgetGate.
      // A denied scope yields no Tier-1 propositions (Tier 0 results only).
      if (!this.#chargeBatch(this.#budgetGate, mapped)) return tier0Results;

      for (const r of mapped) assertCostReported(r);
      return mapped;
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

  #tierLatency = new Map<0 | 1, { calls: number; totalMs: number; judgments: number }>();

  /** Phase 5: per-level latency accounting (L0 deterministic / L1 manifold heads). */
  #recordLatency(tier: 0 | 1, startMs: number, judgments: number): void {
    const stats = this.#tierLatency.get(tier) ?? { calls: 0, totalMs: 0, judgments: 0 };
    stats.calls++;
    stats.totalMs += performance.now() - startMs;
    stats.judgments += judgments;
    this.#tierLatency.set(tier, stats);
  }

  latencyStats(): Record<string, { calls: number; totalMs: number; judgments: number; meanMs: number }> {
    return Object.fromEntries(
      [...this.#tierLatency.entries()].map(([tier, s]) => [
        `L${tier}`,
        { ...s, meanMs: s.calls > 0 ? s.totalMs / s.calls : 0 },
      ])
    );
  }

  #chargeBatch(gate: KernelBudgetGate | null, results: readonly JudgmentProposition[]): boolean {
    if (!gate) return true;
    const maxCost = results.reduce(
      (best, r) =>
        r.cost && resourceCostToLmCalls(r.cost) > resourceCostToLmCalls(best) ? r.cost : best,
      results[0]?.cost ?? { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 }
    );
    return chargeJudgment(gate, this.#budgetScopeId, maxCost).granted;
  }

  async *synthesize(
    context: CognitiveContext,
    query: SynthesisQuery,
    budget: ReasoningBudget
  ): AsyncGenerator<SynthesisProposition> {
    // TODO19 honest-defaults: an absent cortex is absent — placeholder
    // candidates must never reach proposeAndJudge's admission path (they
    // would otherwise be committed to memory as beliefs). The disabled-
    // dispatcher fallback below keeps the Bench-13 stub contract.
    if (!this.#enabled) {
      yield* this.#cortex.synthesize(context, query, budget);
      return;
    }
    if (this.#cortex instanceof StubCortex && this.#cortex.isPlaceholder) return;
    try {
      yield* this.#cortex.synthesize(context, query, budget);
    } catch {
      yield* this.#stubCortex.synthesize(context, query, budget);
    }
  }

  #stubCortex = new StubCortex('tier3-fallback');

  /** CLM hard-negative proximity per candidate (0 = clean, 1 = maximal penalty). */
  async #contrastivePenalties(candidates: readonly string[]): Promise<Map<string, number>> {
    const penalties = new Map<string, number>();
    const memory = this.#contrastive;
    if (!memory || memory.isEmpty() || !this.#embeddingCache) return penalties;
    for (const candidate of candidates) {
      try {
        const pointer = await this.#embeddingCache.write(candidate);
        const embedding = this.#embeddingCache.read(pointer);
        const score = embedding ? memory.score(embedding) : undefined;
        if (score !== undefined) penalties.set(candidate, 1 - score);
      } catch {
        // Unembeddable candidate — no penalty
      }
    }
    return penalties;
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

    const selectQ = candidates.length
      ? buildSelectQuery(candidates, synthesisQuery.instruction)
      : undefined;
    const queries: readonly JudgmentQuery[] = selectQ
      ? [selectQ, ...judgmentQueries]
      : judgmentQueries;

    const sharedContext = await this.#resolveContextPointer(context);
    let judgments: JudgmentProposition[];
    let manifoldFailed = false;
    try {
      judgments = await this.judge(sharedContext, queries, budget);
    } catch {
      judgments = await this.#tier0.judgeBatch(sharedContext, queries, budget);
      manifoldFailed = true;
    }

    const select = selectQ
      ? judgments.find((j) => j.kind === 'classify' && j.axis === 'teleological')
      : undefined;
    // Manifold-validated only (tier 1): Tier 0/3 fallbacks carry no calibrated authority,
    // so their output is admitted provisionally (§6.4).
    const selectUsable =
      select &&
      !select.abstained &&
      select.kind === 'classify' &&
      (select as ClassifyProposition).tier === 1;

    // R5: Per-candidate embeddings — write each candidate to cache and evaluate individually
    // so ranking discriminates content, not just context.
    let ranking: readonly { option: string; p: number }[] | undefined;
    if (selectUsable && selectQ && this.#embeddingCache) {
      const candidateEmbeddings: EmbeddingPointer[] = [];
      for (const candidate of candidates) {
        const pointer = await this.#embeddingCache.write(candidate);
        candidateEmbeddings.push(pointer);
      }
      // Re-judge candidate_select with per-candidate embeddings; declared extra
      // ranking weights (E2) add per-candidate evaluate queries.
      const extraRubrics = Object.keys(this.#rankingWeights).filter(
        (k) => k !== 'candidate_select'
      );
      const perCandidateQueries: JudgmentQuery[] = candidates.flatMap((c) => [
        {
          kind: 'classify' as const,
          instruction: `Evaluate candidate: ${c}`,
          space: selectQ?.space,
          axis: 'teleological' as const,
          criticality: 'standard' as const,
        },
        ...extraRubrics.map((rubric) => ({
          kind: 'evaluate' as const,
          rubric: rubric as RubricId,
          instruction: `Evaluate candidate: ${c}`,
          axis: 'teleological' as const,
        })),
      ]);
      const candidateJudgments = await this.judge(sharedContext, perCandidateQueries, budget);
      // CLM contrastive routing: candidates near stored hard negatives are
      // penalized proportionally to their negative-proximity (0..1).
      const negativePenalty = await this.#contrastivePenalties(candidates);
      const stride = 1 + extraRubrics.length;
      ranking = candidates.map((c, i) => {
        const base = candidateJudgments[i * stride] as ClassifyProposition;
        const entries = [{ key: 'candidate_select', p: base.top.p, abstained: base.abstained }];
        extraRubrics.forEach((rubric, j) => {
          const prop = candidateJudgments[i * stride + 1 + j] as EvaluateProposition | undefined;
          entries.push({ key: rubric, p: prop?.score ?? 0, abstained: prop?.abstained ?? true });
        });
        const composite = compositeScore(entries, this.#rankingWeights);
        const penalty = negativePenalty.get(c) ?? 0;
        return { option: c, p: Math.max(0, (composite?.score ?? base.top.p) * (1 - penalty)) };
      });
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

export function createDispatcher(
  enabled = false,
  options: DispatcherOptions = {},
  cortex?: GenerativeCortex
): CognitiveDispatcher {
  const tier0 = new DeterministicManifold();
  const tier1 = enabled ? (options.tier1Manifold ?? new DeterministicManifold()) : null;
  const tier3 = new Tier3SymbolicManifold();
  const cortexInstance = cortex ?? new StubCortex('off');
  return new SystemOneDispatcher(tier0, tier1, tier3, cortexInstance, enabled, options);
}
