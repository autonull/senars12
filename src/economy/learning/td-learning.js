/**
 * TD Learning — online temporal difference learning for value estimation.
 */
import { createDefaultClock } from '../../kernel/env';
import { defaultTDConfig, extractFeatures, predictValueFromSF } from './features';
/**
 * Learn from a single transition (online TD).
 */
export function tdStep(from, to, reward, valueWeights, config = defaultTDConfig, clock) {
    const { gamma, alpha, featureDimensions } = config;
    const featureNames = featureDimensions;
    const featureDim = featureNames.length;
    const fromFeatures = extractFeatures(from, featureNames, clock);
    // Compute target
    let nextValue = 0;
    for (const succ of to) {
        const succFeatures = extractFeatures(succ, featureNames, clock);
        let v = 0;
        const weights = valueWeights.weights;
        for (let i = 0; i < featureDim; i++) {
            v += weights[i] * succFeatures[i];
        }
        nextValue += v;
    }
    if (to.length > 0) {
        nextValue /= to.length;
    }
    const target = reward + gamma * nextValue;
    const currentValue = valueWeights.weights.reduce((sum, w, i) => sum + w * fromFeatures[i], 0);
    const tdError = target - currentValue;
    // Update weights
    const newWeights = [...valueWeights.weights];
    for (let i = 0; i < featureDim; i++) {
        newWeights[i] += alpha * tdError * fromFeatures[i];
    }
    const now = clock?.now() ?? createDefaultClock().now();
    return {
        weights: newWeights,
        featureNames,
        updatedAt: now,
        samples: valueWeights.samples + 1,
    };
}
/** Convert successor features to Successor format for scheduler. */
export function successorFeaturesToSuccessors(sf, valueWeights) {
    const value = predictValueFromSF(sf, valueWeights);
    return [{
            tasks: [], // Would need to reconstruct tasks
            probability: 1.0,
            utilityDelta: value,
        }];
}
/** Merge multiple successor feature estimates (e.g., from different log segments). */
export function mergeSuccessorFeatures(features, weights) {
    if (features.length === 0) {
        throw new Error('No features to merge');
    }
    const featureDim = features[0].features.length;
    const merged = new Array(featureDim).fill(0);
    const w = weights ?? new Array(features.length).fill(1 / features.length);
    for (let i = 0; i < features.length; i++) {
        for (let j = 0; j < featureDim; j++) {
            merged[j] += w[i] * features[i].features[j];
        }
    }
    return {
        taskId: features[0].taskId,
        featureNames: features[0].featureNames,
        gamma: features[0].gamma,
        features: merged,
    };
}
