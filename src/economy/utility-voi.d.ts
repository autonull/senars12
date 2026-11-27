/**
 * Utility & Value of Information — utility calculation and VoI for the task economy.
 *
 * U = Σ wᵢ·φᵢ and EU(task) = E[U(s′) − U(s)] − λ·cost − ρ·risk
 * are the only utility arithmetic.
 *
 * VoI measures how much a task contributes to reducing uncertainty about goals
 * and updating beliefs.
 */
import type { EconomyTask, TaskUtility, TaskVoI, Successor, Overlay, SchedulerConfig, EconomyTaskBagKind } from './types';
import type { Clock } from '../kernel/env';
/** Utility weights for different task kinds. */
export declare const KIND_UTILITY_WEIGHTS: Record<string, number>;
/** Cost weights. */
export declare const COST_WEIGHTS: {
    readonly oracleCall: 0.1;
    readonly facultyCall: 0.05;
    readonly derivation: 0.02;
    readonly memoryAccess: 0.01;
    readonly cpuTime: 0.001;
};
/** Risk weights. */
export declare const RISK_WEIGHTS: {
    readonly uncertainty: 0.5;
    readonly contradiction: 1;
    readonly timeout: 0.3;
    readonly sideEffect: 0.7;
};
/**
 * Calculate base utility: U = Σ wᵢ·φᵢ
 * where wᵢ is the task weight and φᵢ is the feature value (truth confidence).
 */
export declare function calculateBaseUtility(task: EconomyTask, overlays?: Overlay[]): number;
/**
 * Calculate expected utility gain: E[U(s') - U(s)]
 * Estimates utility change from executing this task.
 */
export declare function calculateExpectedGain(task: EconomyTask, successors: Successor[], currentTotalUtility: number): number;
/**
 * Calculate cost estimate: λ·cost
 */
export declare function calculateCost(task: EconomyTask, config: SchedulerConfig): number;
/**
 * Calculate risk estimate: ρ·risk
 */
export declare function calculateRisk(task: EconomyTask, clock?: Clock): number;
/**
 * Calculate full task utility: EU = base + expectedGain - cost - risk
 */
export declare function calculateTaskUtility(task: EconomyTask, successors: Successor[], currentTotalUtility: number, config: SchedulerConfig, overlays?: Overlay[]): TaskUtility;
/**
 * Calculate Value of Information for a task.
 */
export declare function calculateVoI(task: EconomyTask, goals: EconomyTask[], beliefs: EconomyTask[]): TaskVoI;
/**
 * Calculate total economy utility: U = Σ wᵢ·φᵢ across all tasks.
 */
export declare function calculateTotalUtility(tasks: EconomyTask[], overlays?: Overlay[]): number;
/**
 * Rank tasks by utility.
 */
export declare function rankTasksByUtility(tasks: EconomyTask[], successors: Map<string, Successor[]>, currentTotalUtility: number, config: SchedulerConfig, overlays?: Overlay[]): Array<{
    task: EconomyTask;
    utility: TaskUtility;
}>;
/** VoI calculation context. */
export interface VoIContext {
    /** Task to evaluate. */
    task: EconomyTask;
    /** Current goals. */
    goals: EconomyTask[];
    /** Current beliefs. */
    beliefs: EconomyTask[];
    /** Current skills. */
    skills: EconomyTask[];
    /** Available oracles. */
    oracleCapabilities: string[];
    /** Available faculties. */
    facultyCapabilities: string[];
    /** Iteration number. */
    iteration: number;
}
/** VoI components breakdown. */
export interface VoIBreakdown {
    /** Goal uncertainty reduction. */
    goalUncertaintyReduction: number;
    /** Belief update potential. */
    beliefUpdatePotential: number;
    /** Skill acquisition value. */
    skillAcquisitionValue: number;
    /** Oracle information gain. */
    oracleInformationGain: number;
    /** Faculty information gain. */
    facultyInformationGain: number;
    /** Exploration bonus. */
    explorationBonus: number;
    /** Total VoI. */
    total: number;
}
/**
 * Calculate detailed VoI for a task.
 */
export declare function calculateDetailedVoI(context: VoIContext): VoIBreakdown;
/**
 * Rank tasks by VoI.
 */
export declare function rankByVoI(tasks: EconomyTask[], goals: EconomyTask[], beliefs: EconomyTask[], skills: EconomyTask[], oracleCapabilities: string[], facultyCapabilities: string[], iteration: number): Array<{
    task: EconomyTask;
    voi: VoIBreakdown;
}>;
/**
 * Select task by VoI (for exploration).
 */
export declare function selectByVoI(tasks: EconomyTask[], goals: EconomyTask[], beliefs: EconomyTask[], skills: EconomyTask[], oracleCapabilities: string[], facultyCapabilities: string[], iteration: number, rng: () => number): EconomyTask | null;
/** Answerability — learned estimate of whether a task can be answered/resolved. */
export interface AnswerabilityModel {
    /** Task features that predict answerability. */
    featureWeights: Record<string, number>;
    /** Bias term. */
    bias: number;
    /** Training samples. */
    samples: number;
    /** Accuracy on validation. */
    accuracy: number;
    /** Updated at. */
    updatedAt: number;
}
/** Default answerability model (uninformative prior). */
export declare const defaultAnswerabilityModel: AnswerabilityModel;
/** Task features for answerability prediction. */
export interface AnswerabilityFeatures {
    /** Has matching oracle. */
    hasOracle: number;
    /** Has matching faculty. */
    hasFaculty: number;
    /** Truth confidence. */
    truthConfidence: number;
    /** Task kind one-hot. */
    taskKind: Record<EconomyTaskBagKind, number>;
    /** Task age (normalized). */
    ageNormalized: number;
    /** Access count (normalized). */
    accessNormalized: number;
}
/** Extract answerability features from a task. */
export declare function extractAnswerabilityFeatures(task: EconomyTask, oracleCapabilities: string[], facultyCapabilities: string[], clock?: Clock): AnswerabilityFeatures;
/** Predict answerability (probability task can be resolved). */
export declare function predictAnswerability(features: AnswerabilityFeatures, model?: AnswerabilityModel): number;
/** Train answerability model from outcomes. */
export declare function trainAnswerabilityModel(outcomes: Array<{
    task: EconomyTask;
    resolved: boolean;
}>, oracleCapabilities: string[], facultyCapabilities: string[], initialModel?: AnswerabilityModel, clock?: Clock): AnswerabilityModel;
/** VoI with learned answerability. */
export interface VoIWithAnswerability extends VoIBreakdown {
    /** Predicted answerability. */
    answerability: number;
    /** Answerability-weighted VoI. */
    adjustedTotal: number;
}
/** Calculate VoI with answerability weighting. */
export declare function calculateVoIWithAnswerability(context: VoIContext, answerabilityModel?: AnswerabilityModel, clock?: Clock): VoIWithAnswerability;
/** Rank tasks by answerability-adjusted VoI. */
export declare function rankByVoIWithAnswerability(tasks: EconomyTask[], goals: EconomyTask[], beliefs: EconomyTask[], skills: EconomyTask[], oracleCapabilities: string[], facultyCapabilities: string[], iteration: number, answerabilityModel?: AnswerabilityModel): Array<{
    task: EconomyTask;
    voi: VoIWithAnswerability;
}>;
//# sourceMappingURL=utility-voi.d.ts.map