import {PreferenceData} from './PreferenceCollector.js';
import {TrajectoryStep} from './ReasoningTrajectoryLogger.js';

export interface RewardFeatures {
    trajectoryLength: number;
    toolCallsCount: number;
    lmResponsesCount: number;
    hasErrors: boolean;
    errorCount: number;
    completionLength: number;
    uniqueTools: number;
    avgToolResponseLength: number;
}

export interface RewardModelConfig {
    lengthWeight?: number;
    toolUseWeight?: number;
    errorPenalty?: number;
    concisenessWeight?: number;
    diversityWeight?: number;
}

export class RewardModel {
    private preferences: PreferenceData[] = [];
    private readonly config: RewardModelConfig;
    private featureWeights: Map<string, number> = new Map();

    constructor(config: RewardModelConfig = {}) {
        this.config = {
            lengthWeight: config.lengthWeight ?? 0.1,
            toolUseWeight: config.toolUseWeight ?? 0.3,
            errorPenalty: config.errorPenalty ?? -0.5,
            concisenessWeight: config.concisenessWeight ?? 0.2,
            diversityWeight: config.diversityWeight ?? 0.2
        };
    }

    addPreferences(prefs: PreferenceData | PreferenceData[]): void {
        const newPrefs = Array.isArray(prefs) ? prefs : [prefs];
        this.preferences.push(...newPrefs);
    }

    computeReward(trajectory: TrajectoryStep[]): number {
        const features = this.extractFeatures(trajectory);
        return this.computeRewardFromFeatures(features);
    }

    computeRewardFromFeatures(features: RewardFeatures): number {
        let reward = 0;

        reward += features.trajectoryLength * this.config.lengthWeight!;
        reward += features.toolCallsCount * this.config.toolUseWeight!;
        reward += features.lmResponsesCount * 0.1;
        reward += features.errorCount * this.config.errorPenalty!;

        if (features.completionLength > 0) {
            const conciseness = 1 / (1 + Math.log(features.completionLength + 1));
            reward += conciseness * this.config.concisenessWeight!;
        }

        if (features.uniqueTools > 1) {
            reward += Math.log(features.uniqueTools) * this.config.diversityWeight!;
        }

        return reward;
    }

    extractFeatures(trajectory: TrajectoryStep[]): RewardFeatures {
        const toolCalls = trajectory.filter(s => s.type === 'tool_call');
        const lmResponses = trajectory.filter(s => s.type === 'lm_response');
        const errors = trajectory.filter(s => s.type === 'lm_failure');
        const uniqueTools = new Set(toolCalls.map(t => (t.data as Record<string, unknown>)?.name || 'unknown'));

        let completionLength = 0;
        let totalToolResponseLength = 0;
        let toolResponseCount = 0;

        trajectory.forEach(step => {
            if (step.type === 'lm_response') {
                const content = (step.data as Record<string, unknown>)?.content || '';
                completionLength += typeof content === 'string' ? content.length : 0;
            }
            if (step.type === 'tool_call') {
                const response = (step.data as Record<string, unknown>)?.content;
                if (response) {
                    const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
                    totalToolResponseLength += responseStr.length;
                    toolResponseCount++;
                }
            }
        });

        return {
            trajectoryLength: trajectory.length,
            toolCallsCount: toolCalls.length,
            lmResponsesCount: lmResponses.length,
            hasErrors: errors.length > 0,
            errorCount: errors.length,
            completionLength,
            uniqueTools: uniqueTools.size,
            avgToolResponseLength: toolResponseCount > 0 ? totalToolResponseLength / toolResponseCount : 0
        };
    }

    trainFromPreferences(iterations: number = 100): { loss: number; accuracy: number } {
        if (this.preferences.length < 2) {
            return {loss: 0, accuracy: 0};
        }

        let totalLoss = 0;
        let correctPredictions = 0;

        for (let i = 0; i < iterations; i++) {
            const sample = this.preferences[Math.floor(Math.random() * this.preferences.length)];
            if (!sample) continue;
            const rewardA = this.computeReward(sample.trajectoryA);
            const rewardB = this.computeReward(sample.trajectoryB);

            const predictedPreference = rewardA > rewardB ? 'A' : rewardB > rewardA ? 'B' : 'SKIP';
            const actualPreference = sample.preference;

            if (actualPreference !== 'SKIP' && predictedPreference === actualPreference) {
                correctPredictions++;
            }

            const targetDiff = actualPreference === 'A' ? 1 : actualPreference === 'B' ? -1 : 0;
            const predictedDiff = rewardA - rewardB;
            const loss = Math.pow(targetDiff - predictedDiff, 2);
            totalLoss += loss;
        }

        return {
            loss: totalLoss / iterations,
            accuracy: correctPredictions / iterations
        };
    }

    updateWeights(preferences: PreferenceData[], learningRate: number = 0.01): void {
        const initialLoss = this.computeLoss(preferences);

        const gradients = new Map<string, number>();
        const epsilon = 0.01;

        for (const [key, baseWeight] of Object.entries(this.config)) {
            if (baseWeight === undefined) continue;

            this.config[key as keyof RewardModelConfig] = baseWeight + epsilon;
            const lossWithPerturbation = this.computeLoss(preferences);
            const gradient = (lossWithPerturbation - initialLoss) / epsilon;
            gradients.set(key, gradient);

            this.config[key as keyof RewardModelConfig] = baseWeight - learningRate * gradient;
        }

        this.normalizeWeights();
    }

    getFeatureImportance(): Map<string, number> {
        return this.featureWeights;
    }

    predict(trajectory: TrajectoryStep[]): { reward: number; features: RewardFeatures } {
        const features = this.extractFeatures(trajectory);
        const reward = this.computeRewardFromFeatures(features);
        return {reward, features};
    }

    compare(trajectoryA: TrajectoryStep[], trajectoryB: TrajectoryStep[]): {
        rewardA: number;
        rewardB: number;
        preferred: 'A' | 'B' | 'TIE';
        confidence: number;
    } {
        const rewardA = this.computeReward(trajectoryA);
        const rewardB = this.computeReward(trajectoryB);
        const diff = Math.abs(rewardA - rewardB);
        const maxDiff = Math.max(Math.abs(rewardA), Math.abs(rewardB), 1);
        const confidence = diff / maxDiff;

        return {
            rewardA,
            rewardB,
            preferred: rewardA > rewardB ? 'A' : rewardB > rewardA ? 'B' : 'TIE',
            confidence
        };
    }

    private computeLoss(preferences: PreferenceData[]): number {
        if (preferences.length === 0) return 0;

        let totalLoss = 0;
        let validCount = 0;

        for (const pref of preferences) {
            if (pref.preference === 'SKIP') continue;

            const rewardA = this.computeReward(pref.trajectoryA);
            const rewardB = this.computeReward(pref.trajectoryB);

            const target = pref.preference === 'A' ? 1 : -1;
            const predicted = rewardA - rewardB;

            totalLoss += Math.pow(target - predicted, 2);
            validCount++;
        }

        return validCount > 0 ? totalLoss / validCount : 0;
    }

    private normalizeWeights(): void {
        let sum = 0;
        const weights: Array<[string, number]> = [];

        for (const [key, value] of Object.entries(this.config)) {
            if (value !== undefined && value > 0) {
                weights.push([key, value]);
                sum += value;
            }
        }

        if (sum > 0) {
            for (const [key, value] of weights) {
                this.config[key as keyof RewardModelConfig] = value / sum;
            }
        }
    }
}
