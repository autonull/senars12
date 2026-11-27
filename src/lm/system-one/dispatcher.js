import { accumulate, indexBy, maxBy, rankBy } from '@senars/util/collections';
import { clamp01, retain, safeRatio } from '@senars/util/numeric';
import { monotonicNow, stopwatch } from '@senars/util/async';
import { DECISION_DERIVATIONS_SCOPE } from '../../kernel/budget-scopes';
import { Stamp } from '../../terms/impls/Stamp';
import { Truth } from '../../terms/impls/Truth';
import { failClosed, isSafetyFloor, validateBatchQueries } from './algebra';
import { DeterministicManifold, Tier3SymbolicManifold } from './constant-manifold';
import { candidateProximity } from './contrastive';
import { selectQuery as buildSelectQuery } from './head-specs';
import { compositeScore } from './policy';
import { createProvisionalStamp } from './provisional-stamp';
import { assertCostReported, chargeJudgment, resourceCostToLmCalls } from './resource-gate';
import { seedTruth } from './seed';
import { candidateSlots, NO_COST, synthesisCandidateCount } from './types';
export { DeterministicManifold, Tier3SymbolicManifold };
export class StubCortex {
    #provider;
    /** True when the stub is a placeholder (no generative backend behind it). */
    isPlaceholder;
    constructor(provider = 'off', isPlaceholder = provider === 'off') {
        this.#provider = provider;
        this.isPlaceholder = isPlaceholder;
    }
    async *synthesize(_context, query, _budget) {
        yield {
            kind: 'synthesize',
            candidates: candidateSlots(synthesisCandidateCount(query)),
            cost: NO_COST,
        };
    }
    health() {
        return { provider: this.#provider, breakerOpen: this.#provider === 'off' };
    }
}
export class SystemOneDispatcher {
    #tier0;
    tier1; // public for test injection
    #tier3;
    #cortex;
    #enabled;
    #embeddingCache;
    #provisional;
    #rankingWeights;
    #budgetGate;
    #budgetScopeId;
    #contrastive;
    constructor(tier0, tier1, tier3, cortex, enabled, options) {
        this.#tier0 = tier0;
        this.tier1 = tier1;
        this.#tier3 = tier3;
        this.#cortex = cortex;
        this.#enabled = enabled;
        this.#embeddingCache = options.embeddingCache ?? null;
        this.#provisional = options.provisional ?? { cInitial: 0.1, decayRate: 0.3, maxTtlMs: 30_000 };
        this.#rankingWeights = options.rankingWeights ?? { candidate_select: 1 };
        this.#budgetGate = options.budgetGate;
        this.#budgetScopeId = options.budgetScopeId ?? DECISION_DERIVATIONS_SCOPE;
        this.#contrastive = options.contrastive ?? null;
    }
    /**
     * Diagnostic introspection (Phase F, audit M4): the CLI status surface needs
     * private-config facts (provisional cache, cortex identity) without the
     * invalid `?.#field` chains bot.ts previously reached through.
     */
    describe() {
        const health = this.#cortex.health?.();
        return {
            enabled: this.#enabled,
            provisional: { ...this.#provisional },
            cortexProvider: health?.provider ?? 'off',
            cortexBreakerOpen: health?.breakerOpen ?? true,
        };
    }
    async judge(sharedContext, queries, budget) {
        validateBatchQueries(queries);
        // Tier 0: Always runs first (deterministic checks)
        const t0Elapsed = stopwatch(monotonicNow);
        const tier0Results = await this.#tier0.judgeBatch(sharedContext, queries, budget);
        this.#recordLatency(0, t0Elapsed, tier0Results.length);
        // If System One is disabled or Tier 1 unavailable, return Tier 0 results
        if (!this.#enabled || !this.tier1) {
            return tier0Results;
        }
        // Tier 1: Manifold (encoder heads)
        try {
            const t1Elapsed = stopwatch(monotonicNow);
            const tier1Results = await this.tier1.judgeBatch(sharedContext, queries, budget);
            this.#recordLatency(1, t1Elapsed, tier1Results.length);
            // Use Tier 1 results when available and confident
            const mapped = tier1Results.map((r, i) => {
                const tier0Result = tier0Results[i];
                const query = queries[i];
                // R6: a safety-floor query that abstained MUST fail closed — never
                // Tier 0 defaults.
                if (r.abstained && isSafetyFloor(query))
                    return failClosed(r);
                return r.abstained || (r.kind === 'classify' && r.top.p < 0.5) ? tier0Result : r;
            });
            // B7/X8: charge the batch (max proposition cost) against the kernel BudgetGate.
            // A denied scope yields no Tier-1 propositions (Tier 0 results only).
            if (!this.#chargeBatch(this.#budgetGate, mapped))
                return tier0Results;
            for (const r of mapped)
                assertCostReported(r);
            return mapped;
        }
        catch {
            // Tier 1 failed, fall through to Tier 3
            // But safety-floor queries still fail closed
            const tier3Results = await this.#tier3.judgeBatch(sharedContext, queries, budget);
            return tier3Results.map((r, i) => (isSafetyFloor(queries[i]) ? failClosed(r) : r));
        }
    }
    #tierLatency = new Map();
    /** Phase 5: per-level latency accounting (L0 deterministic / L1 manifold heads). */
    #recordLatency(tier, elapsed, judgments) {
        accumulate(this.#tierLatency, tier, () => ({ calls: 0, totalMs: 0, judgments: 0 }), (running) => {
            running.calls++;
            running.totalMs += elapsed();
            running.judgments += judgments;
        });
    }
    latencyStats() {
        const stats = {};
        for (const [tier, s] of this.#tierLatency) {
            stats[`L${tier}`] = { ...s, meanMs: safeRatio(s.totalMs, s.calls) };
        }
        return stats;
    }
    #chargeBatch(gate, results) {
        if (!gate)
            return true;
        const maxCost = maxBy(results, (r) => (r.cost ? resourceCostToLmCalls(r.cost) : Number.NEGATIVE_INFINITY))
            ?.cost ?? NO_COST;
        return chargeJudgment(gate, this.#budgetScopeId, maxCost).granted;
    }
    async *synthesize(context, query, budget) {
        // TODO19 honest-defaults: an absent cortex is absent — placeholder
        // candidates must never reach proposeAndJudge's admission path (they
        // would otherwise be committed to memory as beliefs). The disabled-
        // dispatcher fallback below keeps the Bench-13 stub contract.
        if (!this.#enabled) {
            yield* this.#cortex.synthesize(context, query, budget);
            return;
        }
        if (this.#cortex instanceof StubCortex && this.#cortex.isPlaceholder)
            return;
        try {
            yield* this.#cortex.synthesize(context, query, budget);
        }
        catch {
            yield* this.#stubCortex.synthesize(context, query, budget);
        }
    }
    #stubCortex = new StubCortex('tier3-fallback');
    async #resolveContextPointer(context) {
        if (!this.#embeddingCache)
            return 0;
        const text = context.topBeliefs.length > 0 ? context.topBeliefs.join(' ') : context.tickId;
        return this.#embeddingCache.write(text);
    }
    async proposeAndJudge(context, synthesisQuery, judgmentQueries, budget) {
        const candidates = [];
        const seen = new Set();
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
        const queries = selectQ
            ? [selectQ, ...judgmentQueries]
            : judgmentQueries;
        const sharedContext = await this.#resolveContextPointer(context);
        let judgments;
        let manifoldFailed = false;
        try {
            judgments = await this.judge(sharedContext, queries, budget);
        }
        catch {
            judgments = await this.#tier0.judgeBatch(sharedContext, queries, budget);
            manifoldFailed = true;
        }
        const select = selectQ
            ? judgments.find((j) => j.kind === 'classify' && j.axis === 'teleological')
            : undefined;
        // Manifold-validated only (tier 1): Tier 0/3 fallbacks carry no calibrated authority,
        // so their output is admitted provisionally (§6.4).
        const selectUsable = select &&
            !select.abstained &&
            select.kind === 'classify' &&
            select.tier === 1;
        // R5: Re-judge each candidate over the shared context; declared extra ranking
        // weights (E2) add per-candidate evaluate queries.
        let ranking;
        if (selectUsable && selectQ) {
            const extraRubrics = Object.keys(this.#rankingWeights).filter((k) => k !== 'candidate_select');
            const perCandidateQueries = candidates.flatMap((c) => [
                {
                    kind: 'classify',
                    instruction: `Evaluate candidate: ${c}`,
                    space: selectQ?.space,
                    axis: 'teleological',
                    criticality: 'standard',
                },
                ...extraRubrics.map((rubric) => ({
                    kind: 'evaluate',
                    rubric: rubric,
                    instruction: `Evaluate candidate: ${c}`,
                    axis: 'teleological',
                })),
            ]);
            const candidateJudgments = await this.judge(sharedContext, perCandidateQueries, budget);
            // CLM contrastive routing: candidates near stored hard negatives are
            // penalized proportionally to their negative-proximity (0..1).
            const { penalties: negativePenalty } = await candidateProximity(this.#contrastive, this.#embeddingCache, candidates);
            const stride = 1 + extraRubrics.length;
            ranking = candidates.map((c, i) => {
                const base = candidateJudgments[i * stride];
                const entries = [{ key: 'candidate_select', p: base.top.p, abstained: base.abstained }];
                extraRubrics.forEach((rubric, j) => {
                    const prop = candidateJudgments[i * stride + 1 + j];
                    entries.push({ key: rubric, p: prop?.score ?? 0, abstained: prop?.abstained ?? true });
                });
                const composite = compositeScore(entries, this.#rankingWeights);
                const penalty = negativePenalty.get(c) ?? 0;
                return { option: c, p: clamp01(retain(composite?.score ?? base.top.p, penalty)) };
            });
        }
        else {
            ranking = selectUsable ? select.distribution : undefined;
        }
        const pByOption = indexBy(ranking ?? [], (d) => d.option, (d) => d.p);
        const authority = selectUsable ? seedTruth(select).c : 0;
        const ranked = rankBy(candidates.map((candidate) => ({
            candidate,
            truth: ranking ? Truth.create(pByOption.get(candidate) ?? 0, authority) : Truth.NEUTRAL,
        })), (entry) => entry.truth.f);
        const provisional = [];
        const admitted = [];
        const needsProvisional = manifoldFailed || !selectUsable;
        for (const { candidate, truth } of ranked) {
            if (needsProvisional) {
                const stamp = createProvisionalStamp(Stamp.createWithSource('LM'), this.#provisional.cInitial, this.#provisional.decayRate, this.#provisional.maxTtlMs);
                provisional.push({ candidate, provisional: stamp });
            }
            else {
                admitted.push({ candidate, truth, stamp: Stamp.createWithSource('LM') });
            }
        }
        return { candidates, judgments, ranked, admitted, provisional };
    }
}
export function createDispatcher(enabled, options, cortex) {
    const tier0 = new DeterministicManifold();
    const tier1 = enabled ? (options.tier1Manifold ?? new DeterministicManifold()) : null;
    const tier3 = new Tier3SymbolicManifold();
    const cortexInstance = cortex ?? new StubCortex('off');
    return new SystemOneDispatcher(tier0, tier1, tier3, cortexInstance, enabled, options);
}
