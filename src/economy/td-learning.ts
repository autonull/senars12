/**
 * TD Learning — successor feature learning from the log.
 *
 * Learns successor features φ(s) and value function V(s) from logged transitions.
 * Successor features: ψ(s,a) = E[Σ γ^t φ(s_t) | s_0=s, a_0=a]
 * Value: V(s) = w·ψ(s) where w are learned weights.
 */

import type { EconomyTask, Successor, TaskBagKind } from './types';
import type { Term } from '../kernel/terms/term';
import type { Truth } from '../kernel/truth';

/** Transition recorded in the log. */
export interface LoggedTransition {
  /** From state (task). */
  from: EconomyTask;
  /** Action taken. */
  action: string;
  /** To state (tasks). */
  to: EconomyTask[];
  /** Reward (utility delta). */
  reward: number;
  /** Iteration. */
  iteration: number;
  /** Timestamp. */
  timestamp: number;
}

/** Successor feature vector. */
export interface SuccessorFeatures {
  /** Task ID. */
  taskId: string;
  /** Feature vector (one per feature dimension). */
  features: number[];
  /** Feature names. */
  featureNames: string[];
  /** Discount factor. */
  gamma: number;
}

/** Learned value weights. */
export interface ValueWeights {
  /** Weight per feature. */
  weights: number[];
  /** Feature names. */
  featureNames: string[];
  /** Last updated. */
  updatedAt: number;
  /** Sample count. */
  samples: number;
}

/** TD learning configuration. */
export interface TDLearningConfig {
  /** Discount factor. */
  gamma: number;
  /** Learning rate. */
  alpha: number;
  /** Feature dimensions. */
  featureDimensions: string[];
  /** Max history size. */
  maxHistory: number;
}

/** Default TD learning config. */
export const defaultTDConfig: TDLearningConfig = {
  gamma: 0.95,
  alpha: 0.1,
  featureDimensions: [
    'kind_belief',
    'kind_goal',
    'kind_skill',
    'kind_faculty',
    'kind_rule',
    'kind_plan',
    'truth_frequency',
    'truth_confidence',
    'activation',
    'weight',
    'access_count',
    'age_hours',
  ],
  maxHistory: 10000,
};

/** Extract feature vector from a task. */
export function extractFeatures(task: EconomyTask, featureNames: string[]): number[] {
  const features: number[] = [];

  for (const name of featureNames) {
    switch (name) {
      case 'kind_belief':
        features.push(task.kind === 'belief' ? 1 : 0);
        break;
      case 'kind_goal':
        features.push(task.kind === 'goal' ? 1 : 0);
        break;
      case 'kind_skill':
        features.push(task.kind === 'skill' ? 1 : 0);
        break;
      case 'kind_faculty':
        features.push(task.kind === 'faculty' ? 1 : 0);
        break;
      case 'kind_rule':
        features.push(task.kind === 'rule' ? 1 : 0);
        break;
      case 'kind_plan':
        features.push(task.kind === 'plan' ? 1 : 0);
        break;
      case 'truth_frequency':
        features.push(task.truth.f);
        break;
      case 'truth_confidence':
        features.push(task.truth.c);
        break;
      case 'activation':
        features.push(task.activation);
        break;
      case 'weight':
        features.push(Math.min(1, task.weight / 10)); // Normalize
        break;
      case 'access_count':
        features.push(Math.min(1, task.accessCount / 100));
        break;
      case 'age_hours': {
        const ageHours = (Date.now() - task.createdAt) / (1000 * 60 * 60);
        features.push(Math.min(1, ageHours / 168)); // Normalize to week
        break;
      }
      default:
        features.push(0);
    }
  }

  return features;
}

/** Compute successor features for a task using logged transitions. */
export function computeSuccessorFeatures(
  task: EconomyTask,
  transitions: LoggedTransition[],
  config: TDLearningConfig = defaultTDConfig
): SuccessorFeatures {
  const { gamma, featureDimensions } = config;
  const featureNames = featureDimensions;
  const featureDim = featureNames.length;

  // Initialize successor feature vector
  let psi: number[] = new Array(featureDim).fill(0);
  let count = 0;

  // Find transitions from this task
  const relevantTransitions = transitions.filter(t => t.from.id === task.id);

  for (const trans of relevantTransitions) {
    // Average features of successor states
    let succFeatures: number[] = new Array(featureDim).fill(0);
    for (const succTask of trans.to) {
      const f = extractFeatures(succTask, featureNames);
      for (let i = 0; i < featureDim; i++) {
        succFeatures[i]! += f[i]!;
      }
    }

    // Average over successors
    if (trans.to.length > 0) {
      for (let i = 0; i < featureDim; i++) {
        succFeatures[i]! /= trans.to.length;
      }
    }

    // Add immediate features + discounted successor features
    const immediateFeatures = extractFeatures(task, featureNames);
    for (let i = 0; i < featureDim; i++) {
      psi[i]! += immediateFeatures[i]! + gamma * succFeatures[i]!;
    }
    count++;
  }

  // Average over transitions
  if (count > 0) {
    for (let i = 0; i < featureDim; i++) {
      psi[i]! /= count;
    }
  } else {
    // No transitions: use immediate features only
    psi = extractFeatures(task, featureNames);
  }

  return {
    taskId: task.id,
    features: psi,
    featureNames,
    gamma,
  };
}

/** Learn value weights from transitions (TD(0)). */
export function learnValueWeights(
  transitions: LoggedTransition[],
  config: TDLearningConfig = defaultTDConfig,
  initialWeights?: ValueWeights
): ValueWeights {
  const { gamma, alpha, featureDimensions } = config;
  const featureNames = featureDimensions;
  const featureDim = featureNames.length;

  let weights: number[] = initialWeights?.weights ?? new Array(featureDim).fill(0);
  let samples = initialWeights?.samples ?? 0;

  for (const trans of transitions) {
    const fromFeatures = extractFeatures(trans.from, featureNames);

    // Compute target: reward + gamma * V(next_state)
    // Average V over all successor states
    let nextValue = 0;
    for (const succ of trans.to) {
      const succFeatures = extractFeatures(succ, featureNames);
      let v = 0;
      for (let i = 0; i < featureDim; i++) {
        v += weights[i]! * succFeatures[i]!;
      }
      nextValue += v;
    }
    if (trans.to.length > 0) {
      nextValue /= trans.to.length;
    }

    const target = trans.reward + gamma * nextValue;
    const currentValue = weights.reduce((sum, w, i) => sum + w * fromFeatures[i]!, 0);
    const tdError = target - currentValue;

    // Update weights
    for (let i = 0; i < featureDim; i++) {
      weights[i]! += alpha * tdError * fromFeatures[i]!;
    }
    samples++;
  }

  return {
    weights,
    featureNames,
    updatedAt: Date.now(),
    samples,
  };
}

/** Predict value of a task using learned weights. */
export function predictValue(
  task: EconomyTask,
  valueWeights: ValueWeights,
  config: TDLearningConfig = defaultTDConfig
): number {
  const features = extractFeatures(task, valueWeights.featureNames);
  let value = 0;
  const weights = valueWeights.weights;
  for (let i = 0; i < features.length; i++) {
    value += weights[i]! * features[i]!;
  }
  return value;
}

/** Predict value from successor features. */
export function predictValueFromSF(
  sf: SuccessorFeatures,
  valueWeights: ValueWeights
): number {
  let value = 0;
  const weights = valueWeights.weights;
  for (let i = 0; i < sf.features.length; i++) {
    value += weights[i]! * sf.features[i]!;
  }
  return value;
}

/** Learn from a single transition (online TD). */
export function tdStep(
  from: EconomyTask,
  to: EconomyTask[],
  reward: number,
  valueWeights: ValueWeights,
  config: TDLearningConfig = defaultTDConfig
): ValueWeights {
  const { gamma, alpha, featureDimensions } = config;
  const featureNames = featureDimensions;
  const featureDim = featureNames.length;

  const fromFeatures = extractFeatures(from, featureNames);

  // Compute target
  let nextValue = 0;
  for (const succ of to) {
    const succFeatures = extractFeatures(succ, featureNames);
    let v = 0;
    const weights = valueWeights.weights;
    for (let i = 0; i < featureDim; i++) {
      v += weights[i]! * succFeatures[i]!;
    }
    nextValue += v;
  }
  if (to.length > 0) {
    nextValue /= to.length;
  }

  const target = reward + gamma * nextValue;
  const currentValue = valueWeights.weights.reduce((sum, w, i) => sum + w * fromFeatures[i]!, 0);
  const tdError = target - currentValue;

  // Update weights
  const newWeights = [...valueWeights.weights];
  for (let i = 0; i < featureDim; i++) {
    newWeights[i]! += alpha * tdError * fromFeatures[i]!;
  }

  return {
    weights: newWeights,
    featureNames,
    updatedAt: Date.now(),
    samples: valueWeights.samples + 1,
  };
}

/** Convert successor features to Successor format for scheduler. */
export function successorFeaturesToSuccessors(
  sf: SuccessorFeatures,
  valueWeights: ValueWeights
): Successor[] {
  const value = predictValueFromSF(sf, valueWeights);
  return [{
    tasks: [], // Would need to reconstruct tasks
    probability: 1.0,
    utilityDelta: value,
  }];
}

/** Merge multiple successor feature estimates (e.g., from different log segments). */
export function mergeSuccessorFeatures(
  features: SuccessorFeatures[],
  weights?: number[]
): SuccessorFeatures {
  if (features.length === 0) {
    throw new Error('No features to merge');
  }

  const featureDim = features[0]!.features.length;
  const merged: number[] = new Array(featureDim).fill(0);
  const w = weights ?? new Array(features.length).fill(1 / features.length);

  for (let i = 0; i < features.length; i++) {
    for (let j = 0; j < featureDim; j++) {
      merged[j]! += w[i]! * features[i]!.features[j]!;
    }
  }

  return {
    taskId: features[0]!.taskId,
    featureNames: features[0]!.featureNames,
    gamma: features[0]!.gamma,
    features: merged,
  };
}