import type { CeilingReputation, ReasoningBudget } from '@senars/schemas';
import type { IngressJudge, IngressJudgmentRequest, IngressVerdict } from '../../kernel/ingress';
import { type ConfidenceBands } from './policy';
import type { EmbeddingCache, JudgmentManifold } from './types';
export interface SystemOneIngressJudgeConfig {
    manifold: JudgmentManifold;
    embeddingCache: EmbeddingCache;
    /**
     * The judgment pass's own budget.
     *
     * `ReasoningBudget`, not a re-spelling of it: a structural copy here accepts
     * any four numbers and any four counters under those names, so a caller could
     * hand this judge a budget that is not one — and the kernel's accounting,
     * which is the whole point of the type, would never see it.
     */
    budget: ReasoningBudget;
    ambiguityBands?: ConfidenceBands;
    /** Phase E (REFACTOR.todo1): lazy source-reputation lookup (trust-not-truth ceiling). */
    reputation?: () => CeilingReputation | undefined;
    /** Reputation key for this judge's admissions (default 'system-one'). */
    sourceKey?: string;
    /**
     * Phase E (REFACTOR.todo2): finer reputation key — `provider:<name>` for the
     * active LM channel. Preferred over `sourceKey` when derivable; the legacy
     * key stands as fallback (R6 parity).
     */
    provider?: () => string | undefined;
}
/**
 * X2 (TODO20): System One ingress judge — the proposer-side half of the epistemic
 * firewall. Judges a batch of ingress heads and returns typed verdicts; faults
 * propagate so `KernelPerceptionGate` can fail closed (D1).
 */
export declare class SystemOneIngressJudge implements IngressJudge {
    private readonly manifold;
    private readonly embeddingCache;
    private readonly budget;
    private readonly ambiguityRouter;
    private readonly reputation?;
    private readonly sourceKey?;
    private readonly provider?;
    private emitJudgmentResolved;
    constructor(config: SystemOneIngressJudgeConfig);
    setEventSink(push: (event: unknown) => void): void;
    judge(request: IngressJudgmentRequest): Promise<IngressVerdict>;
}
//# sourceMappingURL=ingress-judge.d.ts.map