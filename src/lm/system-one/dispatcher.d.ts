import type { ReasoningBudget } from '@senars/schemas';
import type { KernelBudgetGate } from '../../kernel/KernelBudgetGate';
import { DeterministicManifold, Tier3SymbolicManifold } from './constant-manifold';
import { type ContrastiveMemory } from './contrastive';
import type { CognitiveContext, CognitiveDispatcher, CortexHealth, EmbeddingCache, EmbeddingPointer, GenerativeCortex, JudgmentManifold, JudgmentProposition, JudgmentQuery, PEAResult, SynthesisProposition, SynthesisQuery } from './types';
export { DeterministicManifold, Tier3SymbolicManifold };
export declare class StubCortex implements GenerativeCortex {
    #private;
    /** True when the stub is a placeholder (no generative backend behind it). */
    readonly isPlaceholder: boolean;
    constructor(provider?: string, isPlaceholder?: boolean);
    synthesize(_context: CognitiveContext, query: SynthesisQuery, _budget: ReasoningBudget): AsyncGenerator<SynthesisProposition>;
    health(): CortexHealth;
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
    provisional?: {
        cInitial: number;
        decayRate: number;
        maxTtlMs: number;
    };
    /** E2: declared (never learned) weights for composite ranking. Any key beyond
     *  `candidate_select` adds a per-candidate judgment query (currently `feasibility`). */
    rankingWeights?: Record<string, number>;
    /** B7/X8: flow-level accounting — `judge` charges `systemone-judgment` per batch
     *  (max proposition cost); a denied scope yields no Tier-1 propositions.
     *  A7: the scope is the declared `decision-derivations` bound, not `'default'` —
     *  a judgment's cost is the decision layer's own, and sharing a counter with
     *  anything else would make symbolic derivations budget-dependent. */
    budgetGate: KernelBudgetGate;
    budgetScopeId?: string;
    /** CLM contrastive routing: penalize candidates near stored hard negatives,
     *  and gate proposeAndJudge on in-domain-ness (OOD ⇒ provisional only). */
    contrastive?: ContrastiveMemory;
}
export declare class SystemOneDispatcher implements CognitiveDispatcher {
    #private;
    tier1: JudgmentManifold | null;
    constructor(tier0: JudgmentManifold, tier1: JudgmentManifold | null, tier3: JudgmentManifold, cortex: GenerativeCortex, enabled: boolean, options: DispatcherOptions);
    /**
     * Diagnostic introspection (Phase F, audit M4): the CLI status surface needs
     * private-config facts (provisional cache, cortex identity) without the
     * invalid `?.#field` chains bot.ts previously reached through.
     */
    describe(): {
        enabled: boolean;
        provisional: {
            cInitial: number;
            decayRate: number;
            maxTtlMs: number;
        };
        cortexProvider: string;
        cortexBreakerOpen: boolean;
    };
    judge(sharedContext: EmbeddingPointer, queries: readonly JudgmentQuery[], budget: ReasoningBudget): Promise<JudgmentProposition[]>;
    latencyStats(): Record<string, {
        calls: number;
        totalMs: number;
        judgments: number;
        meanMs: number;
    }>;
    synthesize(context: CognitiveContext, query: SynthesisQuery, budget: ReasoningBudget): AsyncGenerator<SynthesisProposition>;
    proposeAndJudge(context: CognitiveContext, synthesisQuery: SynthesisQuery, judgmentQueries: readonly JudgmentQuery[], budget: ReasoningBudget): Promise<PEAResult>;
}
export declare function createDispatcher(enabled: boolean, options: DispatcherOptions, cortex?: GenerativeCortex): CognitiveDispatcher;
//# sourceMappingURL=dispatcher.d.ts.map