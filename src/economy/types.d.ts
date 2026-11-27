/**
 * Economy Types — core types for the task economy.
 *
 * The economy replaces focus, strategies, drives, RL/RLFP/reflex, proposal and autonomy
 * with one task economy and one loop.
 */
import type { Term } from '../kernel/terms';
import type { Truth } from '../kernel/truth';
import type { Task } from '../kernel/types';
import type { RNG, Clock } from '../kernel/env';
/** Economy task bag kinds — extends NAR task vocabulary with economy-specific kinds. */
export declare const ECONOMY_TASK_BAG_KINDS: readonly ['belief', 'goal', 'skill', 'faculty', 'rule', 'plan'];
export type EconomyTaskBagKind = (typeof ECONOMY_TASK_BAG_KINDS)[number];
/** Economy task — the atomic unit of work in the economy. */
export interface EconomyTask extends Omit<Task, 'kind'> {
    /** Unique task ID. */
    id: string;
    /** Term representing the task. */
    term: Term;
    /** Task kind. */
    kind: EconomyTaskBagKind;
    /** Truth value. */
    truth: Truth;
    /** Utility weight. */
    weight: number;
    /** Activation level [0,1]. */
    activation: number;
    /** Source of this task. */
    source: TaskSource;
    /** Creation timestamp. */
    createdAt: number;
    /** Last accessed timestamp. */
    lastAccessed: number;
    /** Access count. */
    accessCount: number;
    /** Dependencies (task IDs). */
    dependencies: string[];
    /** Derived from another task. */
    derived: boolean;
    /** Metareasoning margin. */
    margin?: number;
    /** Tags. */
    tags: string[];
}
/** Task source. */
export declare const TASK_SOURCES: readonly ['perception', 'reflex', 'oracle', 'derivation', 'proposal', 'curriculum', 'growth', 'repair', 'faculty'];
export type TaskSource = (typeof TASK_SOURCES)[number];
/** Task utility components. */
export interface TaskUtility {
    /** Base utility Σ wᵢ·φᵢ. */
    base: number;
    /** Expected utility gain E[U(s') - U(s)]. */
    expectedGain: number;
    /** Cost estimate λ·cost. */
    cost: number;
    /** Risk estimate ρ·risk. */
    risk: number;
    /** Final utility EU = base + expectedGain - cost - risk. */
    total: number;
}
/** Value of Information. */
export interface TaskVoI {
    /** VoI value. */
    value: number;
    /** Uncertainty reduction potential. */
    uncertaintyReduction: number;
    /** Goal alignment. */
    goalAlignment: number;
    /** Belief relevance. */
    beliefRelevance: number;
}
/** Successor function output. */
export interface Successor {
    /** Resulting state tasks. */
    tasks: EconomyTask[];
    /** Probability. */
    probability: number;
    /** Utility delta. */
    utilityDelta: number;
}
/** Metareasoning decision. */
export declare const METAREASONING_DECISIONS: readonly ['think', 'act', 'delegate', 'defer'];
export type MetareasoningDecision = (typeof METAREASONING_DECISIONS)[number];
/** Metareasoning result. */
export interface MetareasoningResult {
    /** Decision. */
    decision: MetareasoningDecision;
    /** Confidence. */
    confidence: number;
    /** Reasoning. */
    reasoning: string;
    /** Budget allocated. */
    budgetAllocated: number;
}
/** Aging policy. */
export interface AgingPolicy {
    /** Decay rate per iteration. */
    decayRate: number;
    /** Minimum activation. */
    minActivation: number;
    /** Access boost. */
    accessBoost: number;
    /** Max age (iterations). */
    maxAge: number;
}
/** Overlay for context-specific weighting. */
export interface Overlay {
    /** Overlay ID. */
    id: string;
    /** Name. */
    name: string;
    /** Weight multiplier per kind. */
    kindWeights: Partial<Record<EconomyTaskBagKind, number>>;
    /** Weight multiplier per source. */
    sourceWeights: Partial<Record<TaskSource, number>>;
    /** Tag weights. */
    tagWeights: Record<string, number>;
    /** Active. */
    active: boolean;
}
/** Scheduler configuration. */
export interface SchedulerConfig {
    /** Budget per iteration. */
    budgetPerIteration: number;
    /** Fairness window. */
    fairnessWindow: number;
    /** Minimum weight for scheduling. */
    minWeight: number;
    /** Exploration probability. */
    explorationRate: number;
    /** Aging policy. */
    aging: AgingPolicy;
    /** Overlays. */
    overlays: Overlay[];
    /** Metareasoning enabled. */
    metareasoningEnabled: boolean;
    /** Margin threshold for think vs act. */
    marginThreshold: number;
    /** Clock (inject for deterministic replay). */
    clock?: Clock;
    /** RNG (inject for deterministic replay). */
    rng?: RNG;
    /** RNG seed (inject for deterministic replay). */
    seed?: number;
}
/** Default scheduler config. */
export declare const defaultSchedulerConfig: SchedulerConfig;
/** Economy state. */
export interface EconomyState {
    /** All tasks by ID. */
    tasks: Map<string, EconomyTask>;
    /** Task bags by kind. */
    bags: Map<EconomyTaskBagKind, Set<string>>;
    /** Current iteration. */
    iteration: number;
    /** Total utility. */
    totalUtility: number;
    /** Scheduler stats. */
    schedulerStats: SchedulerStats;
    /** Active overlays. */
    activeOverlays: Overlay[];
    /** Pick history for fairness tracking. */
    pickHistory: PickRecord[];
    /** Scheduler configuration (embedded for pure functions). */
    config: SchedulerConfig;
}
/** Task pick record for fairness tracking. */
export interface PickRecord {
    /** Task ID. */
    taskId: string;
    /** Task kind. */
    kind: EconomyTaskBagKind;
    /** Iteration when picked. */
    iteration: number;
    /** Utility at pick time. */
    utility: number;
}
/** Scheduler statistics. */
export interface SchedulerStats {
    /** Tasks scheduled. */
    tasksScheduled: number;
    /** Fairness violations. */
    fairnessViolations: number;
    /** Exploration picks. */
    explorationPicks: number;
    /** Metareasoning think decisions. */
    thinkDecisions: number;
    /** Metareasoning act decisions. */
    actDecisions: number;
    /** Average utility per iteration. */
    avgUtility: number;
}
/** Economy event. */
export declare const ECONOMY_EVENTS: readonly ['task_added', 'task_removed', 'task_updated', 'task_scheduled', 'task_completed', 'task_failed', 'overlay_activated', 'overlay_deactivated', 'budget_exhausted', 'fairness_violation'];
export type EconomyEventType = (typeof ECONOMY_EVENTS)[number];
export interface EconomyEvent {
    type: EconomyEventType;
    taskId?: string;
    iteration: number;
    timestamp: number;
    data: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map