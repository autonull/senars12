/**
 * Loop Selection — action selection for the cognitive loop.
 *
 * Implements multiple selection strategies: utility-based, VoI-based, epsilon-greedy, etc.
 */
import type { Task } from '../kernel/types';
import type { RNG, Clock } from '../kernel/env';
/** Selection strategies. */
export declare const SELECTION_STRATEGIES: readonly ['utility', 'voi', 'epsilon_greedy', 'thompson', 'ucb', 'softmax', 'priority'];
export type SelectionStrategy = (typeof SELECTION_STRATEGIES)[number];
/** Selection context. */
export interface SelectionContext {
    /** Available actions/candidates. */
    candidates: SelectionCandidate[];
    /** Current beliefs. */
    beliefs: Task[];
    /** Current goals. */
    goals: Task[];
    /** Available budget. */
    budget: number;
    /** Urgency (0-1). */
    urgency: number;
    /** Risk tolerance (0-1). */
    riskTolerance: number;
    /** Iteration number. */
    iteration: number;
    /** Previous selections. */
    history: SelectionRecord[];
    /** Metadata. */
    metadata?: Record<string, unknown>;
}
/** Selection candidate. */
export interface SelectionCandidate {
    /** Unique ID. */
    id: string;
    /** The proposed action/task. */
    action: Task;
    /** Expected utility. */
    utility: number;
    /** Value of Information. */
    voi: number;
    /** Confidence in estimates. */
    confidence: number;
    /** Source faculty. */
    sourceFaculty: string;
    /** Evidence. */
    evidence: SelectionEvidence[];
    /** Cost estimate. */
    cost: number;
    /** Risk estimate. */
    risk: number;
    /** Priority. */
    priority: number;
}
/** Selection evidence. */
export interface SelectionEvidence {
    /** Source. */
    source: 'faculty' | 'oracle' | 'memory' | 'rule';
    /** Description. */
    description: string;
    /** Strength. */
    strength: number;
}
/** Selection record for history. */
export interface SelectionRecord {
    /** Iteration. */
    iteration: number;
    /** Selected candidate ID. */
    candidateId: string;
    /** Strategy used. */
    strategy: SelectionStrategy;
    /** Actual outcome. */
    outcome?: SelectionOutcome;
}
/** Selection outcome. */
export interface SelectionOutcome {
    /** Success. */
    success: boolean;
    /** Actual utility achieved. */
    actualUtility: number;
    /** Actual cost. */
    actualCost: number;
    /** Reward. */
    reward: number;
}
/** Selection result. */
export interface SelectionResult {
    /** Selected candidate. */
    selected: SelectionCandidate | null;
    /** All candidates with scores. */
    scored: ScoredCandidate[];
    /** Strategy used. */
    strategy: SelectionStrategy;
    /** Selection metadata. */
    metadata: SelectionMetadata;
}
/** Scored candidate. */
export interface ScoredCandidate {
    candidate: SelectionCandidate;
    score: number;
    rank: number;
}
/** Selection metadata. */
export interface SelectionMetadata {
    /** Number of candidates considered. */
    candidatesConsidered: number;
    /** Time taken (ms). */
    durationMs: number;
    /** Whether exploration was used. */
    explored: boolean;
    /** Temperature/epsilon used. */
    explorationParam: number;
}
/** Selector configuration. */
export interface SelectorConfig {
    /** Default strategy. */
    defaultStrategy: SelectionStrategy;
    /** Strategy weights for ensemble. */
    strategyWeights?: Record<SelectionStrategy, number>;
    /** Epsilon for epsilon-greedy. */
    epsilon?: number;
    /** Temperature for softmax. */
    temperature?: number;
    /** Exploration decay. */
    explorationDecay?: number;
    /** Minimum exploration. */
    minExploration?: number;
}
/** Default selector configuration. */
export declare const defaultSelectorConfig: SelectorConfig;
/** Action selector. */
export declare class ActionSelector {
    private config;
    private currentEpsilon;
    private currentTemperature;
    private selectionCounts;
    private rewardSums;
    private rewardCounts;
    private readonly rng;
    private readonly clock;
    constructor(config?: Partial<SelectorConfig>, options?: {
        rng?: RNG;
        clock?: Clock;
    });
    /** Select an action. */
    select(context: SelectionContext): Promise<SelectionResult>;
    /** Choose strategy based on context. */
    private chooseStrategy;
    /** Score candidates using a strategy. */
    private scoreCandidates;
    /** Apply softmax transformation. */
    private applySoftmax;
    /** Thompson sampling score. */
    private thompsonScore;
    /** UCB score. */
    private ucbScore;
    /** Sample from Beta distribution (approximation). */
    private sampleBeta;
    /** Sample from Gamma distribution (Marsaglia's method). */
    private sampleGamma;
    /** Generate normal random (Box-Muller). */
    private normalRandom;
    /** Select from scored candidates. */
    private selectFromScored;
    /** Epsilon-greedy selection. */
    private epsilonGreedySelect;
    /** Softmax selection. */
    private softmaxSelect;
    /** Update exploration parameters. */
    private updateExploration;
    /** Record selection outcome for learning. */
    recordOutcome(candidateId: string, reward: number): void;
    /** Get selection statistics. */
    getStats(): {
        totalSelections: number;
        candidateStats: Record<string, {
            count: number;
            avgReward: number;
        }>;
        currentEpsilon: number;
        currentTemperature: number;
    };
    /** Empty result. */
    private emptyResult;
}
/** Create an action selector. */
export declare function createActionSelector(config?: Partial<SelectorConfig>, options?: {
    rng?: RNG;
    clock?: Clock;
}): ActionSelector;
/** Global action selector instance (non-deterministic; prefer {@link createActionSelector}). */
export declare const actionSelector: ActionSelector;
/** VoI (Value of Information) calculator. */
export declare class VoICalculator {
    /** Calculate VoI for a candidate. */
    static calculate(candidate: SelectionCandidate, beliefs: Task[], goals: Task[]): number;
    /** Compute alignment between action and goal. */
    private static computeAlignment;
    /** Compute relevance of action to belief. */
    private static computeRelevance;
    /** Compute surprise potential. */
    private static computeSurprise;
    /** Common substring helper. */
    private static commonSubstring;
}
//# sourceMappingURL=select.d.ts.map