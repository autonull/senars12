import type { BackendId, CalibrationVersion, ConsensusResult, EmbeddingPointer, JudgmentManifold, JudgmentProposition, JudgmentQuery, ManifoldHealth, ModelDigest, ReasoningBudget } from './types';
interface ConstantManifoldConfig {
    tier: 0 | 3;
    backendId: BackendId;
    modelDigest: ModelDigest;
    calibrationVersion: CalibrationVersion;
    /** Probability mass on the first classify option; remainder spread evenly over the rest. */
    topP: number;
    ece: number;
    latencyMs: number;
}
/** One constant-table manifold covers the tier-0 deterministic and tier-3 symbolic stubs (G3/X5). */
export declare class ConstantManifold implements JudgmentManifold {
    #private;
    constructor(config: ConstantManifoldConfig);
    judgeBatch(_sharedContext: EmbeddingPointer, queries: readonly JudgmentQuery[], _budget: ReasoningBudget): Promise<JudgmentProposition[]>;
    consensus(_sharedContext: EmbeddingPointer, query: JudgmentQuery, _k: number, _budget: ReasoningBudget): Promise<ConsensusResult>;
    health(): ManifoldHealth;
}
export declare class DeterministicManifold extends ConstantManifold {
    constructor();
}
export declare class Tier3SymbolicManifold extends ConstantManifold {
    constructor();
}
export {};
//# sourceMappingURL=constant-manifold.d.ts.map