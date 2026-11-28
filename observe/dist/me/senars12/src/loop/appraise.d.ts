/**
 * Loop Appraisal — meta-evaluation of loop performance and health.
 *
 * Provides continuous assessment of loop quality, efficiency, and alignment.
 */
import type { ContractCheckResult } from './contract';
import type { Clock } from '../kernel/env';
/** Appraisal dimensions. */
export declare const APPRAISAL_DIMENSIONS: readonly ['efficiency', 'effectiveness', 'coherence', 'adaptability', 'safety', 'progress'];
export type AppraisalDimension = (typeof APPRAISAL_DIMENSIONS)[number];
/** Appraisal result for a dimension. */
export interface DimensionAppraisal {
    /** Dimension name. */
    dimension: AppraisalDimension;
    /** Score [0,1]. */
    score: number;
    /** Confidence in score. */
    confidence: number;
    /** Supporting evidence. */
    evidence: AppraisalEvidence[];
    /** Trend: improving, stable, declining. */
    trend: 'improving' | 'stable' | 'declining';
    /** Metadata. */
    metadata?: Record<string, unknown>;
}
/** Appraisal evidence. */
export interface AppraisalEvidence {
    /** Source of evidence. */
    source: 'metric' | 'contract' | 'oracle' | 'heuristic';
    /** Description. */
    description: string;
    /** Value. */
    value: number;
    /** Weight. */
    weight: number;
}
/** Full appraisal result. */
export interface LoopAppraisal {
    /** Overall score [0,1]. */
    overallScore: number;
    /** Dimension scores. */
    dimensions: DimensionAppraisal[];
    /** Timestamp. */
    timestamp: number;
    /** Iteration. */
    iteration: number;
    /** Summary. */
    summary: string;
    /** Recommendations. */
    recommendations: string[];
}
/** Appraisal configuration. */
export interface AppraisalConfig {
    /** Dimension weights. */
    weights: Record<AppraisalDimension, number>;
    /** Minimum evidence required. */
    minEvidence: number;
    /** History window for trends. */
    historyWindow: number;
    /** Enable detailed appraisal. */
    detailed: boolean;
}
/** Default appraisal configuration. */
export declare const defaultAppraisalConfig: AppraisalConfig;
/** Metrics collected for appraisal. */
export interface AppraisalMetrics {
    /** Tokens per iteration. */
    tokensPerIteration: number;
    /** Wall time per iteration (ms). */
    timePerIteration: number;
    /** Oracle calls per iteration. */
    oracleCallsPerIteration: number;
    /** Success rate of oracle calls. */
    oracleSuccessRate: number;
    /** Contract violation rate. */
    contractViolationRate: number;
    /** Belief growth rate. */
    beliefGrowthRate: number;
    /** Goal achievement rate. */
    goalAchievementRate: number;
    /** Contradiction rate. */
    contradictionRate: number;
    /** Unique tasks processed. */
    uniqueTasksRatio: number;
    /** Fallback usage rate. */
    fallbackUsageRate: number;
}
/** Loop appraiser. */
export declare class LoopAppraiser {
    private config;
    private history;
    private metricsHistory;
    private iteration;
    private readonly clock;
    constructor(config?: Partial<AppraisalConfig>, options?: {
        clock?: Clock;
    });
    /** Record metrics for an iteration. */
    recordMetrics(metrics: AppraisalMetrics): void;
    /** Record contract results. */
    recordContractResults(results: ContractCheckResult[]): void;
    /** Perform appraisal. */
    appraise(iteration: number, metrics: AppraisalMetrics): LoopAppraisal;
    /** Appraise all dimensions. */
    private appraiseDimensions;
    /** Appraise efficiency. */
    private appraiseEfficiency;
    /** Appraise effectiveness. */
    private appraiseEffectiveness;
    /** Appraise coherence. */
    private appraiseCoherence;
    /** Appraise adaptability. */
    private appraiseAdaptability;
    /** Appraise safety. */
    private appraiseSafety;
    /** Appraise progress. */
    private appraiseProgress;
    /** Compute weighted average of evidence. */
    private weightedAverage;
    /** Compute overall score. */
    private computeOverallScore;
    /** Compute trend for a dimension. */
    private computeTrend;
    /** Generate summary. */
    private generateSummary;
    /** Generate recommendations. */
    private generateRecommendations;
    /** Normalize tokens per iteration (lower is better). */
    private normalizeTokens;
    /** Normalize time per iteration (lower is better). */
    private normalizeTime;
    /** Normalize oracle calls (lower is better). */
    private normalizeOracleCalls;
    /** Normalize growth rate. */
    private normalizeGrowth;
    /** Estimate belief consistency. */
    private estimateBeliefConsistency;
    /** Estimate strategy diversity. */
    private estimateStrategyDiversity;
    /** Estimate action safety. */
    private estimateActionSafety;
    /** Get appraisal history. */
    getHistory(limit?: number): LoopAppraisal[];
    /** Get latest appraisal. */
    getLatest(): LoopAppraisal | null;
    /** Get dimension trends. */
    getTrends(): Record<AppraisalDimension, {
        scores: number[];
        current: number;
    }>;
    /** Get statistics. */
    getStats(): {
        totalAppraisals: number;
        avgOverallScore: number;
        currentOverallScore: number;
        dimensionAverages: Record<AppraisalDimension, number>;
    };
}
/** Create a loop appraiser. */
export declare function createLoopAppraiser(config?: Partial<AppraisalConfig>, options?: {
    clock?: Clock;
}): LoopAppraiser;
/** Global loop appraiser instance (non-deterministic; prefer {@link createLoopAppraiser}). */
export declare const loopAppraiser: LoopAppraiser;
/** Metrics collector for appraisal. */
export declare class AppraisalMetricsCollector {
    private iteration;
    private tokensUsed;
    private oracleCalls;
    private oracleSuccesses;
    private contractViolations;
    private contractChecks;
    private beliefsStart;
    private goalsAchieved;
    private goalsTotal;
    private contradictions;
    private uniqueTasks;
    private totalTasks;
    private fallbacksUsed;
    private totalFacultyCalls;
    /** Start a new iteration. */
    startIteration(beliefsCount: number): void;
    /** Record token usage. */
    recordTokens(tokens: number): void;
    /** Record oracle call. */
    recordOracleCall(success: boolean): void;
    /** Record contract check. */
    recordContractCheck(passed: boolean): void;
    /** Record goal achievement. */
    recordGoalAchieved(): void;
    /** Record goal failed. */
    recordGoalFailed(): void;
    /** Record contradiction. */
    recordContradiction(): void;
    /** Record task processed. */
    recordTask(task: string): void;
    /** Record fallback used. */
    recordFallback(): void;
    /** Record faculty call. */
    recordFacultyCall(): void;
    /** Build metrics snapshot. */
    buildMetrics(): AppraisalMetrics;
    /** Reset for new appraisal window. */
    reset(): void;
}
//# sourceMappingURL=appraise.d.ts.map