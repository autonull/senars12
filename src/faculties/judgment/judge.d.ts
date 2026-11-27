/**
 * Learned Judge — a learned model for judgment scoring.
 *
 * Can be trained on judgment outcomes to improve calibration and selection.
 */
import type { JudgmentCandidate, JudgmentContext } from './cascade';
import type { TelemetryCollector } from './telemetry';
/** Judge training example. */
export interface JudgeTrainingExample {
    /** The situation. */
    situation: string;
    /** The candidate. */
    candidate: JudgmentCandidate;
    /** The context. */
    context: JudgmentContext;
    /** Whether the judgment was correct (ground truth). */
    correct: boolean;
    /** Outcome score (0-1). */
    outcomeScore: number;
}
/** Judge features extracted from candidate + context. */
export interface JudgeFeatures {
    /** Candidate confidence. */
    candidateConfidence: number;
    /** Number of evidence pieces. */
    evidenceCount: number;
    /** Average evidence strength. */
    avgEvidenceStrength: number;
    /** Source faculty encoded. */
    sourceFaculty: number;
    /** Goal alignment (0-1). */
    goalAlignment: number;
    /** Belief support (0-1). */
    beliefSupport: number;
    /** Urgency. */
    urgency: number;
    /** Risk tolerance. */
    riskTolerance: number;
    /** Budget fraction used. */
    budgetFraction: number;
    /** Number of competing candidates. */
    numCandidates: number;
    /** Stage reached. */
    stageReached: number;
}
/** Judge model interface. */
export interface JudgeModel {
    /** Predict score for features. */
    predict(features: JudgeFeatures): number;
    /** Train on examples. */
    train(examples: JudgeTrainingExample[]): Promise<void>;
    /** Save model. */
    save(): Promise<void>;
    /** Load model. */
    load(): Promise<void>;
    /** Get model info. */
    getInfo(): JudgeModelInfo;
    /** Extract features from candidate and context. */
    extractFeatures(candidate: JudgmentCandidate, context: JudgmentContext, numCandidates: number): JudgeFeatures;
}
/** Judge model info. */
export interface JudgeModelInfo {
    type: string;
    version: string;
    trainingExamples: number;
    lastTrained: number;
    metrics?: JudgeMetrics;
}
/** Judge metrics. */
export interface JudgeMetrics {
    accuracy: number;
    auc: number;
    calibrationError: number;
    brierScore: number;
}
/** Simple logistic regression judge. */
export declare class LogisticJudge implements JudgeModel {
    private weights;
    private bias;
    private featureNames;
    private version;
    private trainingExamples;
    private lastTrained;
    private readonly rng;
    private readonly now;
    private readonly telemetry?;
    constructor(options?: {
        rng?: () => number;
        now?: () => number;
        telemetry?: TelemetryCollector;
    });
    /** Extract features from candidate and context. */
    extractFeatures(candidate: JudgmentCandidate, context: JudgmentContext, numCandidates: number): JudgeFeatures;
    /** Compute goal alignment. */
    private computeGoalAlignment;
    /** Compute belief support. */
    private computeBeliefSupport;
    /** Longest common substring ratio. */
    private commonSubstring;
    /** Convert features to array. */
    private featuresToArray;
    /** Sigmoid function. */
    private sigmoid;
    /** Predict score. */
    predict(features: JudgeFeatures): number;
    /** Train using gradient descent. */
    train(examples: JudgeTrainingExample[]): Promise<void>;
    /** Predict from feature array. */
    private predictFromArray;
    /** Save model to storage. */
    save(): Promise<void>;
    /** Load model from storage. */
    load(): Promise<void>;
    /** Get model info. */
    getInfo(): JudgeModelInfo;
}
/** Judge ensemble for better predictions. */
export declare class JudgeEnsemble implements JudgeModel {
    private models;
    private weights;
    /** Add a model to the ensemble. */
    addModel(model: JudgeModel, weight?: number): void;
    /** Predict using weighted average. */
    predict(features: JudgeFeatures): number;
    /** Train all models. */
    train(examples: JudgeTrainingExample[]): Promise<void>;
    /** Save all models. */
    save(): Promise<void>;
    /** Load all models. */
    load(): Promise<void>;
    /** Get ensemble info. */
    getInfo(): JudgeModelInfo;
    /** Extract features from candidate and context (delegates to first model). */
    extractFeatures(candidate: JudgmentCandidate, context: JudgmentContext, numCandidates: number): JudgeFeatures;
}
/** Judge calibration using isotonic regression. */
export declare class IsotonicCalibrator {
    private bins;
    private calibratedMap;
    /** Record a prediction outcome. */
    record(predicted: number, correct: boolean): void;
    /** Calibrate a prediction. */
    calibrate(predicted: number): number;
    /** Recompute calibration map using isotonic regression (PAVA). */
    recompute(): void;
    /** Get calibration data. */
    getData(): {
        predicted: number;
        observed: number;
        count: number;
    }[];
}
/** Create an isolated judge ensemble (deterministic when `rng`/`now` are supplied). */
export declare function createJudge(options?: {
    rng?: () => number;
    now?: () => number;
    telemetry?: TelemetryCollector;
}): JudgeEnsemble;
/** Create a default judge ensemble. */
export declare function createDefaultJudge(): JudgeEnsemble;
/** Global judge instance (convenience; prefer {@link createJudge}). */
export declare const learnedJudge: JudgeEnsemble;
//# sourceMappingURL=judge.d.ts.map