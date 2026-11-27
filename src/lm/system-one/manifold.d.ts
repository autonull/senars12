import type { ReasoningBudget } from '@senars/schemas';
import { type DriftDemotionConfig, DriftDemotionManager, type IsotonicCalibrator, type RollingECEConfig } from './calibration';
import { type CalibrationLock } from './calibration-fit';
import { type ContrastiveMemory } from './contrastive';
import type { PerHeadConfig } from './heads/factory';
import type { BackendId, CalibrationVersion, ConsensusResult, EmbeddingCache, EmbeddingPointer, JudgmentHead, JudgmentManifold, JudgmentProposition, JudgmentQuery, ManifoldHealth, ModelDigest, ResourceCost } from './types';
export interface ManifoldConfig {
    backendId: BackendId;
    modelDigest: ModelDigest;
    calibrationVersion: CalibrationVersion;
    embeddingCache: EmbeddingCache;
    heads: Map<string, JudgmentHead>;
    rollingECEConfig?: Partial<RollingECEConfig>;
    driftDemotionConfig?: Partial<DriftDemotionConfig>;
    maxBatchSize: number;
    maxLatencyMs: number;
    abstainThreshold: number;
    /** Optional callback invoked for each resolved judgment proposition.
     *  Allows consumers to emit kernel events and metrics without coupling the manifold to the event system. */
    onProposition?: (proposition: JudgmentProposition, query: JudgmentQuery) => void;
    /** Digest-pinned calibration lock (D2): fitted calibrators + per-head abstain thresholds. */
    calibrationLock?: CalibrationLock;
    /** CLM contrastive exemplar memory: zero-shot cosine fallback when heads are unfitted. */
    contrastive?: ContrastiveMemory;
}
export declare class SystemOneManifold implements JudgmentManifold {
    #private;
    constructor(config: ManifoldConfig);
    judgeBatch(sharedContext: EmbeddingPointer, queries: readonly JudgmentQuery[], _budget: ReasoningBudget): Promise<JudgmentProposition[]>;
    consensus(sharedContext: EmbeddingPointer, query: JudgmentQuery, k: number, budget: ReasoningBudget): Promise<ConsensusResult>;
    health(): ManifoldHealth;
    getEmbeddingCache(): EmbeddingCache;
    getCalibrators(): ReadonlyMap<string, IsotonicCalibrator>;
    /** Registered judgment heads (Phase F, audit M4 — replaces private-name reach-in). */
    getHeads(): ReadonlyMap<string, JudgmentHead>;
    getDriftDemotionManager(): DriftDemotionManager;
    setDemoted(demoted: boolean): void;
    registerHead(head: JudgmentHead): void;
    /** Per-head abstain thresholds from the loaded calibration lock (empty when unfitted). */
    getAbstainThresholds(): ReadonlyMap<string, number>;
    getCalibrationLock(): CalibrationLock | undefined;
    estimateCost: (query: JudgmentQuery, latencyMs: number) => ResourceCost;
    syncHealth(): void;
    /** Register or update the telemetry callback for resolved propositions. */
    setPropositionCallback(callback: ManifoldConfig['onProposition']): void;
    /** Current telemetry callback (enables multi-consumer chaining). */
    getPropositionCallback(): ManifoldConfig['onProposition'];
    getContrastiveMemory(): ContrastiveMemory | undefined;
    /**
     * CLM scaling-law head sizing (Kwok et al. 2026): optimal projection-head
     * width grows as a power law in the labeled-data budget. With N labels and
     * embedding dim D: width = clamp(D · (N/N₀)^0.18, 8, D) — N₀ = 64 labels at
     * full width. Returns the recommended width and stores it for telemetry.
     */
    suggestHeadSize(labelCount: number, embeddingDim?: number): number;
    getLastSuggestedHeadSize(): number;
}
export declare function createManifold(embeddingCache: EmbeddingCache, config?: Partial<ManifoldConfig> & {
    perHeadConfig?: Record<string, PerHeadConfig>;
}): SystemOneManifold;
//# sourceMappingURL=manifold.d.ts.map