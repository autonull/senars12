/**
 * Feature Extraction — extracts numerical features from economy tasks for learning.
 */
import { TermOp } from '../../kernel/terms';
import { createDefaultClock } from '../../kernel/env';
/** Feature names used in TD learning. */
export const FEATURE_NAMES = [
    'truth-frequency',
    'truth-confidence',
    'task-weight',
    'task-activation',
    'task-age',
    'kind-goal',
    'kind-belief',
    'kind-skill',
    'kind-faculty',
    'kind-rule',
    'kind-plan',
    'source-perception',
    'source-derivation',
    'source-oracle',
    'source-faculty',
    'term-depth',
    'term-width',
    'term-has-variable',
];
/** Feature dimension count. */
export const FEATURE_DIM = FEATURE_NAMES.length;
/** Extract numerical features from a task. */
export function extractFeatures(task, featureNames = FEATURE_NAMES, clock) {
    const features = new Array(featureNames.length).fill(0);
    const now = clock?.now() ?? createDefaultClock().now();
    for (let i = 0; i < featureNames.length; i++) {
        const name = featureNames[i];
        features[i] = extractSingleFeature(task, name, now);
    }
    return features;
}
/** Extract a single feature by name. */
function extractSingleFeature(task, name, now) {
    switch (name) {
        case 'truth-frequency':
            return task.truth.f;
        case 'truth-confidence':
            return task.truth.c;
        case 'task-weight':
            return task.weight;
        case 'task-activation':
            return task.activation;
        case 'task-age':
            return Math.min(1, (now - task.createdAt) / 86400000); // Normalize to days
        case 'kind-goal':
            return task.kind === 'goal' ? 1 : 0;
        case 'kind-belief':
            return task.kind === 'belief' ? 1 : 0;
        case 'kind-skill':
            return task.kind === 'skill' ? 1 : 0;
        case 'kind-faculty':
            return task.kind === 'faculty' ? 1 : 0;
        case 'kind-rule':
            return task.kind === 'rule' ? 1 : 0;
        case 'kind-plan':
            return task.kind === 'plan' ? 1 : 0;
        case 'source-perception':
            return task.source === 'perception' ? 1 : 0;
        case 'source-derivation':
            return task.source === 'derivation' ? 1 : 0;
        case 'source-oracle':
            return task.source === 'oracle' ? 1 : 0;
        case 'source-faculty':
            return task.source === 'faculty' ? 1 : 0;
        case 'term-depth':
            return computeTermDepth(task.term);
        case 'term-width':
            return computeTermWidth(task.term);
        case 'term-has-variable':
            return hasVariable(task.term) ? 1 : 0;
        default:
            return 0;
    }
}
/** Compute term depth (nesting level). */
function computeTermDepth(term) {
    if (term.op === TermOp.VARIABLE || term.op === TermOp.CONSTANT)
        return 1;
    return 1 + Math.max(...term.args.map(computeTermDepth));
}
/** Compute term width (number of arguments). */
function computeTermWidth(term) {
    if (term.op === TermOp.VARIABLE || term.op === TermOp.CONSTANT)
        return 0;
    return term.args.length;
}
/** Check if term contains a variable. */
function hasVariable(term) {
    if (term.op === TermOp.VARIABLE)
        return true;
    if (term.op === TermOp.CONSTANT)
        return false;
    return term.args.some(hasVariable);
}
/** Default TD learning configuration. */
export const defaultTDConfig = {
    gamma: 0.95,
    alpha: 0.1,
    featureDimensions: FEATURE_NAMES,
};
/**
 * Compute successor features for a task using TD(λ).
 *
 * Accumulates discounted feature expectations over successor trajectories.
 */
export function computeSuccessorFeatures(task, successors, config = defaultTDConfig, visited = new Set(), depth = 0, clock) {
    const { gamma, featureDimensions } = config;
    const featureDim = featureDimensions.length;
    // Base features for current task
    const baseFeatures = extractFeatures(task, featureDimensions, clock);
    if (depth > 10 || visited.has(task.id) || successors.length === 0) {
        return {
            taskId: task.id,
            featureNames: featureDimensions,
            gamma,
            features: baseFeatures,
        };
    }
    visited.add(task.id);
    // Accumulate discounted successor features
    const accumulated = new Array(featureDim).fill(0);
    for (const succ of successors) {
        const succSF = computeSuccessorFeatures(succ, [], config, new Set(visited), depth + 1, clock);
        for (let i = 0; i < featureDim; i++) {
            accumulated[i] += gamma * succSF.features[i];
        }
    }
    // Average over successors
    for (let i = 0; i < featureDim; i++) {
        accumulated[i] /= successors.length;
    }
    // Combine base + discounted successors
    const combined = new Array(featureDim);
    for (let i = 0; i < featureDim; i++) {
        combined[i] = baseFeatures[i] + accumulated[i];
    }
    return {
        taskId: task.id,
        featureNames: featureDimensions,
        gamma,
        features: combined,
    };
}
/**
 * Learn value weights from transitions using TD learning.
 */
export function learnValueWeights(transitions, config = defaultTDConfig, initialWeights, clock) {
    const { gamma, alpha, featureDimensions } = config;
    const featureDim = featureDimensions.length;
    let weights = initialWeights?.weights ?? new Array(featureDim).fill(0);
    let samples = initialWeights?.samples ?? 0;
    const now = clock?.now() ?? createDefaultClock().now();
    for (const trans of transitions) {
        const fromFeatures = extractFeatures(trans.from, featureDimensions, clock);
        const target = trans.reward + gamma * computeNextValue(trans.to, weights, featureDimensions, clock);
        const currentValue = weights.reduce((sum, w, i) => sum + w * fromFeatures[i], 0);
        const tdError = target - currentValue;
        // Update weights
        for (let i = 0; i < featureDim; i++) {
            weights[i] += alpha * tdError * fromFeatures[i];
        }
        samples++;
    }
    return {
        weights,
        featureNames: featureDimensions,
        updatedAt: now,
        samples,
    };
}
/** Compute next state value from successor tasks. */
function computeNextValue(tasks, weights, featureNames, clock) {
    if (tasks.length === 0)
        return 0;
    let total = 0;
    for (const task of tasks) {
        const features = extractFeatures(task, featureNames, clock);
        let v = 0;
        for (let i = 0; i < weights.length; i++) {
            v += weights[i] * features[i];
        }
        total += v;
    }
    return total / tasks.length;
}
/** Predict value of a task using learned weights. */
export function predictValue(task, valueWeights, config = defaultTDConfig, clock) {
    const features = extractFeatures(task, valueWeights.featureNames, clock);
    let value = 0;
    const weights = valueWeights.weights;
    for (let i = 0; i < features.length; i++) {
        value += weights[i] * features[i];
    }
    return value;
}
/** Predict value from successor features. */
export function predictValueFromSF(sf, valueWeights) {
    let value = 0;
    const weights = valueWeights.weights;
    for (let i = 0; i < sf.features.length; i++) {
        value += weights[i] * sf.features[i];
    }
    return value;
}
