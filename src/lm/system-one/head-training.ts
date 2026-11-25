/**
 * Head training for System One.
 * Trains linear/logistic regression heads on (embedding, action) → target.
 */

import { clamp01, pearson, sigmoid } from '@senars/util/numeric';
import { meanBrierOf } from './metrics';
import { holdoutSplit, mulberry32 } from '@senars/util/random';
import { SenarsError } from '../../errors/senars-error';
import { solveLinearSystem } from './linear-algebra';
import { actionFeatures, ACTION_FEATURE_SEED, GAME_FEATURE_SEED } from './features';
import { sha256Prefixed } from '@senars/util/hash';
import {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL_ID,
} from '../../memory/embedding';
import type { TrainingRow, TrainingOptions, HeadMetrics, HeadIdentity, HeadGeometry, TrainedHeadModel, CognitiveAxis, RubricId } from './types';

/** Internal: build feature vector for one training row. */
function buildFeatures(
  row: TrainingRow,
  actionFeatureDim: number,
  gameFeatureDim = 0
): Float32Array {
  const dim = row.embedding.length + gameFeatureDim;
  const features = new Float32Array(dim);
  if (actionFeatureDim === 0) features.set(row.embedding);
  else {
    // Hadamard conditioning: e ⊙ h(action) spans per-(state, action) directions,
    // so state-dependent action preferences are representable (an appended action
    // block only adds a shared per-action offset — insufficient for value heads).
    const h = actionFeatures(row.action, row.embedding.length);
    for (let i = 0; i < row.embedding.length; i++) features[i] = row.embedding[i]! * h[i]!;
  }
  if (gameFeatureDim > 0 && row.game) {
    const g = actionFeatures(row.game, gameFeatureDim, GAME_FEATURE_SEED);
    features.set(g, row.embedding.length);
  }
  return features;
}

/** Parameters as bytes: the vector, then the bias as a trailing f32. */
function weightsBytes(weights: Float32Array, bias: number): Buffer {
  const biasBuf = Buffer.alloc(4);
  biasBuf.writeFloatLE(bias);
  return Buffer.concat([
    Buffer.from(weights.buffer, weights.byteOffset, weights.byteLength),
    biasBuf,
  ]);
}

const digestWeights = (weights: Float32Array, bias: number): string =>
  sha256Prefixed(weightsBytes(weights, bias));

/** Extract the geometry (identity + shape) from a trained model. */
function geometryOf(model: TrainedHeadModel): HeadGeometry {
  return {
    headId: model.headId,
    rubric: model.rubric,
    axis: model.axis,
    kind: model.kind,
    embeddingDim: model.embeddingDim,
    actionFeatureDim: model.actionFeatureDim,
    gameFeatureDim: model.gameFeatureDim,
    encoder: model.encoder,
    metrics: model.metrics,
  };
}

/**
 * Train a single judgment head.
 * Closed-form ridge for linear kind; batch GD with early stopping for logistic.
 */
export function trainHead(
  rows: readonly TrainingRow[],
  meta: HeadIdentity,
  options: TrainingOptions = {}
): TrainedHeadModel {
  const kind = options.kind ?? 'linear';
  const actionFeatureDim = options.actionFeatureDim ?? 64;
  const gameFeatureDim = options.gameFeatureDim ?? 0;
  const epochs = options.epochs ?? 600;
  const lr = options.lr ?? 0.05;
  const l2 = options.l2 ?? 1e-4;
  const holdoutFraction = options.holdoutFraction ?? 0.2;
  const patience = options.patience ?? 50;
  const rng = mulberry32(options.seed ?? 42);

  if (rows.length < 4) throw new SenarsError(`Insufficient training rows: ${rows.length}`, 'OPERATION_ERROR');
  const embeddingDim = rows[0]!.embedding.length;
  // Hadamard conditioning keeps the action-conditioned space at the embedding
  // dimension; the game block (shared heads) appends gameFeatureDim hashed dims.
  const dim = embeddingDim + gameFeatureDim;

  const { holdout, train } = holdoutSplit(rows, holdoutFraction, rng);

  // Standardize features on the training split.
  const mean = new Float32Array(dim);
  const std = new Float32Array(dim);
  for (const row of train) {
    const f = buildFeatures(row, actionFeatureDim, gameFeatureDim);
    for (let i = 0; i < dim; i++) mean[i]! += f[i]! / train.length;
  }
  for (const row of train) {
    const f = buildFeatures(row, actionFeatureDim, gameFeatureDim);
    for (let i = 0; i < dim; i++) std[i]! += (f[i]! - mean[i]!) ** 2 / train.length;
  }
  for (let i = 0; i < dim; i++) std[i] = Math.sqrt(std[i]!) || 1;

  const zscore = (f: Float32Array, out: Float32Array) => {
    for (let i = 0; i < dim; i++) out[i] = (f[i]! - mean[i]!) / std[i]!;
  };

  const weights = new Float32Array(dim);
  let bias = 0;
  const grad = new Float32Array(dim);
  const zf = new Float32Array(dim);
  const zhf = new Float32Array(dim);

  const predictZ = (row: TrainingRow, isHoldout: boolean): number => {
    const f = buildFeatures(row, actionFeatureDim, gameFeatureDim);
    const buf = isHoldout ? zhf : zf;
    zscore(f, buf);
    let z = bias;
    for (let i = 0; i < dim; i++) z += weights[i]! * buf[i]!;
    return z;
  };
  const predict = (row: TrainingRow, isHoldout = false): number =>
    kind === 'logistic' ? sigmoid(predictZ(row, isHoldout)) : clamp01(predictZ(row, isHoldout));

  const brier = (set: readonly TrainingRow[]) =>
    meanBrierOf(
      set,
      (row) => predict(row, set === holdout),
      (row) => clamp01(row.target)
    );

  let bestHoldout = Infinity;
  let bestSnapshot = { weights: new Float32Array(weights), bias };
  let stale = 0;
  let epoch = 0;

  if (kind === 'linear') {
    // Closed-form ridge (exact, deterministic — GD plateaus on small-eigenmode features).
    const d = dim + 1;
    const A: number[][] = Array.from({ length: d }, () => new Array<number>(d).fill(0));
    const b = new Array<number>(d).fill(0);
    for (const row of train) {
      const f = buildFeatures(row, actionFeatureDim, gameFeatureDim);
      zscore(f, zf);
      for (let i = 0; i < d; i++) {
        const xi = i < dim ? zf[i]! : 1;
        b[i]! += xi * clamp01(row.target);
        for (let j = 0; j < d; j++) {
          const xj = j < dim ? zf[j]! : 1;
          A[i]![j]! += xi * xj;
        }
      }
    }
    for (let i = 0; i < dim; i++) A[i]![i]! += l2 * train.length;
    const solution = solveLinearSystem(A, b);
    for (let i = 0; i < dim; i++) weights[i] = solution[i] ?? 0;
    bias = solution[dim] ?? 0;
    epoch = 1;
  } else {
    for (; epoch < epochs; epoch++) {
      // Batch-mean gradient step (per-sample GD diverges when lr·λmax > 2).
      grad.fill(0);
      let biasGrad = 0;
      for (const row of train) {
        const f = buildFeatures(row, actionFeatureDim, gameFeatureDim);
        zscore(f, zf);
        const z = predictZ(row, false);
        const err = (kind === 'logistic' ? sigmoid(z) : z) - clamp01(row.target);
        for (let i = 0; i < dim; i++) grad[i]! += (err * zf[i]! + l2 * weights[i]!) / train.length;
        biasGrad += err / train.length;
      }
      for (let i = 0; i < dim; i++) weights[i] = weights[i]! - lr * grad[i]!;
      bias -= lr * biasGrad;

      const holdoutLoss = brier(holdout);
      if (Number.isFinite(holdoutLoss) && holdoutLoss < bestHoldout - 1e-6) {
        bestHoldout = holdoutLoss;
        bestSnapshot = { weights: new Float32Array(weights), bias };
        stale = 0;
      } else if (++stale >= patience) {
        break;
      }
    }
  }

  if (kind === 'linear') {
    bestHoldout = brier(holdout);
    bestSnapshot = { weights: new Float32Array(weights), bias };
  }

  weights.set(bestSnapshot.weights);
  bias = bestSnapshot.bias;

  const trainLoss = brier(train);
  const predictions = rows.map((r) => predict(r, true));
  const targets = rows.map((r) => clamp01(r.target));
  const weightsDigest = digestWeights(weights, bias);

  return {
    headId: meta.headId,
    rubric: meta.rubric,
    axis: meta.axis,
    kind,
    embeddingDim,
    actionFeatureDim,
    gameFeatureDim,
    weights,
    bias,
    mean,
    std,
    encoder: { modelId: DEFAULT_EMBEDDING_MODEL_ID, dimension: DEFAULT_EMBEDDING_DIMENSION },
    weightsDigest,
    metrics: {
      samples: rows.length,
      epochs: epoch + 1,
      trainLoss,
      holdoutLoss: bestHoldout,
      valueCorrelation: pearson(predictions, targets),
    },
  };
}