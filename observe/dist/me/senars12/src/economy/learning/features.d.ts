/**
 * Feature Extraction — extracts numerical features from economy tasks for learning.
 */
import type { EconomyTask } from '../types';
import type { Clock } from '../../kernel/env';
/** Feature names used in TD learning. */
export declare const FEATURE_NAMES: readonly ['truth-frequency', 'truth-confidence', 'task-weight', 'task-activation', 'task-age', 'kind-goal', 'kind-belief', 'kind-skill', 'kind-faculty', 'kind-rule', 'kind-plan', 'source-perception', 'source-derivation', 'source-oracle', 'source-faculty', 'term-depth', 'term-width', 'term-has-variable'];
/** Feature dimension count. */
export declare const FEATURE_DIM: 18;
/** Extract numerical features from a task. */
export declare function extractFeatures(task: EconomyTask, featureNames?: readonly string[], clock?: Clock): number[];
/** Successor features for TD learning. */
export interface SuccessorFeatures {
    /** Task ID these features represent. */
    taskId: string;
    /** Feature names. */
    featureNames: readonly string[];
    /** Discount factor. */
    gamma: number;
    /** Feature vector. */
    features: number[];
}
/** Value weights for TD learning. */
export interface ValueWeights {
    /** Learned weights. */
    weights: number[];
    /** Feature names. */
    featureNames: readonly string[];
    /** Last update timestamp. */
    updatedAt: number;
    /** Number of samples. */
    samples: number;
}
/** TD Learning configuration. */
export interface TDLearningConfig {
    /** Discount factor. */
    gamma: number;
    /** Learning rate. */
    alpha: number;
    /** Feature dimensions to use. */
    featureDimensions: readonly string[];
}
/** Default TD learning configuration. */
export declare const defaultTDConfig: TDLearningConfig;
/**
 * Compute successor features for a task using TD(λ).
 *
 * Accumulates discounted feature expectations over successor trajectories.
 */
export declare function computeSuccessorFeatures(task: EconomyTask, successors: EconomyTask[], config?: TDLearningConfig, visited?: Set<string>, depth?: number, clock?: Clock): SuccessorFeatures;
/**
 * Learn value weights from transitions using TD learning.
 */
export declare function learnValueWeights(transitions: Array<{
    from: EconomyTask;
    to: EconomyTask[];
    reward: number;
}>, config?: TDLearningConfig, initialWeights?: ValueWeights, clock?: Clock): ValueWeights;
/** Predict value of a task using learned weights. */
export declare function predictValue(task: EconomyTask, valueWeights: ValueWeights, config?: TDLearningConfig, clock?: Clock): number;
/** Predict value from successor features. */
export declare function predictValueFromSF(sf: SuccessorFeatures, valueWeights: ValueWeights): number;
//# sourceMappingURL=features.d.ts.map