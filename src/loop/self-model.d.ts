/**
 * Self-Model — the system's model of its own capabilities, state, and performance.
 *
 * Maintains a continuously updated model for meta-reasoning and self-improvement.
 */
import type { LoopAppraisal } from './appraise';
import type { Clock } from '../kernel/env';
/** Self-model aspects. */
export declare const SELF_MODEL_ASPECTS: readonly ['capabilities', 'knowledge', 'performance', 'preferences', 'goals', 'limitations', 'history'];
export type SelfModelAspect = (typeof SELF_MODEL_ASPECTS)[number];
/** Capability assessment. */
export interface CapabilityAssessment {
    /** Capability name. */
    name: string;
    /** Proficiency [0,1]. */
    proficiency: number;
    /** Confidence in assessment. */
    confidence: number;
    /** Evidence. */
    evidence: CapabilityEvidence[];
    /** Last updated. */
    lastUpdated: number;
    /** Trend. */
    trend: 'improving' | 'stable' | 'declining';
}
/** Capability evidence. */
export interface CapabilityEvidence {
    /** Source. */
    source: 'success' | 'failure' | 'feedback' | 'benchmark' | 'self_report';
    /** Description. */
    description: string;
    /** Weight. */
    weight: number;
    /** Timestamp. */
    timestamp: number;
}
/** Knowledge state. */
export interface KnowledgeState {
    /** Domain. */
    domain: string;
    /** Coverage [0,1]. */
    coverage: number;
    /** Certainty [0,1]. */
    certainty: number;
    /** Key concepts known. */
    concepts: string[];
    /** Gaps identified. */
    gaps: string[];
    /** Last updated. */
    lastUpdated: number;
}
/** Performance profile. */
export interface PerformanceProfile {
    /** Overall score [0,1]. */
    overallScore: number;
    /** Dimension scores. */
    dimensions: Record<string, number>;
    /** Recent trend. */
    trend: 'improving' | 'stable' | 'declining';
    /** Strengths. */
    strengths: string[];
    /** Weaknesses. */
    weaknesses: string[];
    /** Benchmarks. */
    benchmarks: PerformanceBenchmark[];
}
/** Performance benchmark. */
export interface PerformanceBenchmark {
    /** Task name. */
    task: string;
    /** Expected performance. */
    expected: number;
    /** Actual performance. */
    actual: number;
    /** Variance. */
    variance: number;
    /** Runs. */
    runs: number;
}
/** Preference model. */
export interface PreferenceModel {
    /** Preference type. */
    type: 'goal' | 'action' | 'strategy' | 'resource' | 'risk';
    /** Target. */
    target: string;
    /** Preference strength [-1,1]. */
    strength: number;
    /** Confidence. */
    confidence: number;
    /** Origin. */
    origin: 'innate' | 'learned' | 'inferred' | 'explicit';
}
/** Goal model. */
export interface GoalModel {
    /** Goal ID. */
    id: string;
    /** Goal description. */
    description: string;
    /** Priority [0,1]. */
    priority: number;
    /** Progress [0,1]. */
    progress: number;
    /** Sub-goals. */
    subGoals: GoalModel[];
    /** Status. */
    status: 'active' | 'paused' | 'completed' | 'abandoned';
    /** Dependencies. */
    dependencies: string[];
}
/** Limitation acknowledgment. */
export interface Limitation {
    /** Limitation type. */
    type: 'knowledge' | 'capability' | 'resource' | 'architectural' | 'safety';
    /** Description. */
    description: string;
    /** Severity [0,1]. */
    severity: number;
    /** Workarounds. */
    workarounds: string[];
    /** Impact assessment. */
    impact: string;
}
/** Historical episode. */
export interface Episode {
    /** Episode ID. */
    id: string;
    /** Type. */
    type: 'task' | 'interaction' | 'learning' | 'repair' | 'evaluation';
    /** Summary. */
    summary: string;
    /** Outcome. */
    outcome: 'success' | 'failure' | 'partial' | 'inconclusive';
    /** Key lessons. */
    lessons: string[];
    /** Timestamp. */
    timestamp: number;
    /** Duration (ms). */
    durationMs: number;
    /** Related goals. */
    goals: string[];
}
/** Complete self-model. */
export interface SelfModel {
    /** Capabilities. */
    capabilities: CapabilityAssessment[];
    /** Knowledge. */
    knowledge: KnowledgeState[];
    /** Performance. */
    performance: PerformanceProfile;
    /** Preferences. */
    preferences: PreferenceModel[];
    /** Goals. */
    goals: GoalModel[];
    /** Limitations. */
    limitations: Limitation[];
    /** History. */
    history: Episode[];
    /** Meta-confidence. */
    metaConfidence: number;
    /** Last updated. */
    lastUpdated: number;
}
/** Self-model configuration. */
export interface SelfModelConfig {
    /** Max history episodes. */
    maxHistory: number;
    /** Update interval (iterations). */
    updateInterval: number;
    /** Confidence decay rate. */
    confidenceDecay: number;
    /** Enable automatic updates. */
    autoUpdate: boolean;
}
/** Default self-model config. */
export declare const defaultSelfModelConfig: SelfModelConfig;
/** Self-model manager. */
export declare class SelfModelManager {
    private config;
    private model;
    private iteration;
    private pendingUpdates;
    private readonly clock;
    constructor(config?: Partial<SelfModelConfig>, options?: {
        clock?: Clock;
    });
    /** Create initial self-model. */
    private createInitialModel;
    /** Update from appraisal. */
    updateFromAppraisal(appraisal: LoopAppraisal): void;
    /** Update capability from outcome. */
    updateCapability(name: string, success: boolean, evidence?: Partial<CapabilityEvidence>): void;
    /** Update knowledge state. */
    updateKnowledge(domain: string, concepts: string[], gaps: string[]): void;
    /** Add preference. */
    addPreference(preference: PreferenceModel): void;
    /** Update goal progress. */
    updateGoalProgress(goalId: string, progress: number, status?: GoalModel['status']): void;
    /** Add goal. */
    addGoal(goal: GoalModel): void;
    /** Add limitation. */
    addLimitation(limitation: Limitation): void;
    /** Record episode. */
    recordEpisode(episode: Episode): void;
    /** Get capability assessment. */
    getCapability(name: string): CapabilityAssessment | undefined;
    /** Get all capabilities. */
    getCapabilities(): CapabilityAssessment[];
    /** Get knowledge for domain. */
    getKnowledge(domain: string): KnowledgeState | undefined;
    /** Get performance profile. */
    getPerformance(): PerformanceProfile;
    /** Get preferences. */
    getPreferences(type?: PreferenceModel['type']): PreferenceModel[];
    /** Get goals. */
    getGoals(status?: GoalModel['status']): GoalModel[];
    /** Get limitations. */
    getLimitations(type?: Limitation['type']): Limitation[];
    /** Get recent history. */
    getHistory(limit?: number): Episode[];
    /** Get complete self-model. */
    getModel(): SelfModel;
    /** Compute performance trend. */
    private computePerformanceTrend;
    /** Extract strengths from appraisal. */
    private extractStrengths;
    /** Extract weaknesses from appraisal. */
    private extractWeaknesses;
    /** Compute capability trend. */
    private computeCapabilityTrend;
    /** Decay confidence over time. */
    decayConfidence(): void;
    /** Tick - called each iteration. */
    tick(): void;
    /** Serialize model. */
    serialize(): string;
    /** Deserialize model. */
    deserialize(json: string): void;
}
/** Create a self-model manager. */
export declare function createSelfModelManager(config?: Partial<SelfModelConfig>, options?: {
    clock?: Clock;
}): SelfModelManager;
/** Global self-model manager (non-deterministic; prefer {@link createSelfModelManager}). */
export declare const selfModelManager: SelfModelManager;
//# sourceMappingURL=self-model.d.ts.map