import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  clamp01,
  ensureDir,
  fillSeededUnitRange,
  groupBy,
  holdoutSplit,
  mulberry32,
  pearson,
  readJsonlAsync,
  seededStringHash,
  sha256HexParts,
  sha256Prefixed,
  sigmoid,
  writeJsonFile,
} from '@senars/util';

export { pearson };

import { DEFAULT_EMBEDDING_DIMENSION, DEFAULT_EMBEDDING_MODEL_ID } from '../../memory/embedding.js';
import { decodeVector } from './distill.js';
import { meanBrierOf } from './metrics.js';
import type { CognitiveAxis, JudgmentHead, JudgmentQuery, RubricId } from './types.js';
import { composeModelDigest, DigestMismatchError, encoderDigest } from './wasi-runtime.js';

// ─── Feature construction ────────────────────────────────────────────────────

/** Deterministic per-action feature block so one head can score (state, action) pairs. */
export function actionFeatures(action: string, dim: number, seed = 0x9e3779b9): Float32Array {
  return fillSeededUnitRange(new Float32Array(dim), seededStringHash(action, seed ^ dim));
}

export function parseActionFromInstruction(instruction: string): string {
  return instruction.match(/action (\S+)$/)?.[1] ?? '';
}

// ─── Data loading (Z1: JSONL rows joined with the vector sidecar) ────────────

export interface TrainingRow {
  embedding: Float32Array;
  action: string;
  target: number;
  /** Registry game the row was played in — feeds the shared-head `game` feature (L3). */
  game?: string;
}

export interface LoadTrainingDataOptions {
  datasetPath: string;
  headId: string;
  /** Fold duplicate (state, action) rows into their mean target (MC-return noise reduction). */
  averageDuplicates?: boolean;
}

interface RawLabel {
  evidenceId: string;
  rubric: string;
  label: string;
  score?: number;
  observed?: number;
  vector?: string;
}

export async function loadTrainingData(options: LoadTrainingDataOptions): Promise<TrainingRow[]> {
  const { rows: rawRows } = await readJsonlAsync<RawLabel>(
    options.datasetPath,
    (value) => value as RawLabel
  );

  const grouped = new Map<string, { sum: number; count: number; action: string; vector: string }>();
  for (const label of rawRows) {
    if (label.rubric !== options.headId) continue;
    const target = label.observed ?? label.score;
    if (target === undefined || !Number.isFinite(target) || !label.vector) continue;
    const key = `${label.evidenceId}`;
    const existing = grouped.get(key);
    if (existing && options.averageDuplicates !== false) {
      existing.sum += target;
      existing.count++;
    } else if (!existing) {
      grouped.set(key, { sum: target, count: 1, action: label.label, vector: label.vector });
    }
  }

  const trainingRows: TrainingRow[] = [];
  for (const { sum, count, action, vector } of grouped.values()) {
    trainingRows.push({ embedding: decodeVector(vector), action, target: sum / count });
  }
  return trainingRows;
}

// ─── Trainer (DQ3: TS linear/logistic heads, frozen backbone) ────────────────

export interface TrainingOptions {
  kind?: 'linear' | 'logistic';
  actionFeatureDim?: number;
  /** Dense hashed `game` block appended to features (0 = per-game head; >0 = shared head). */
  gameFeatureDim?: number;
  epochs?: number;
  lr?: number;
  l2?: number;
  holdoutFraction?: number;
  patience?: number;
  seed?: number;
}

export interface HeadMetrics {
  samples: number;
  epochs: number;
  trainLoss: number;
  holdoutLoss: number;
  valueCorrelation?: number;
}

/**
 * What a head is, as opposed to where its numbers live. Identity, feature
 * geometry, encoder binding and training metrics are the same whether the head
 * is in memory or on disk; only the standardization stats and the parameters
 * themselves change representation — typed arrays in memory, a JSON config plus
 * a weight blob on disk. That split was not declared anywhere: both shapes were
 * written out in full and `exportArtifacts` copied eleven fields by hand, so a
 * field added to one head had to be remembered in three places to reach the
 * other.
 */
export interface HeadGeometry {
  headId: string;
  rubric: string;
  axis: string;
  kind: 'linear' | 'logistic';
  embeddingDim: number;
  actionFeatureDim: number;
  gameFeatureDim: number;
  encoder: { modelId: string; dimension: number };
  metrics: HeadMetrics;
}

export interface TrainedHeadModel extends HeadGeometry {
  weights: Float32Array;
  bias: number;
  /** Standardization stats (features are z-scored before the linear pass). */
  mean: Float32Array;
  std: Float32Array;
  weightsDigest: string;
}

/** The geometry of a trained head, read by name. Annotated `HeadGeometry`, so a
 *  field the two shapes do not share fails here rather than going unexported. */
const geometryOf = (model: TrainedHeadModel): HeadGeometry => ({
  headId: model.headId,
  rubric: model.rubric,
  axis: model.axis,
  kind: model.kind,
  embeddingDim: model.embeddingDim,
  actionFeatureDim: model.actionFeatureDim,
  gameFeatureDim: model.gameFeatureDim,
  encoder: model.encoder,
  metrics: model.metrics,
});

/** Gaussian elimination with partial pivoting (A square, nonsingular). */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r]![col]!) > Math.abs(M[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(M[pivot]![col]!) < 1e-12) continue;
    [M[col], M[pivot]] = [M[pivot]!, M[col]!];
    const p = M[col]![col]!;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r]![col]! / p;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r]![c]! -= factor * M[col]![c]!;
    }
  }
  return M.map((row, i) => (Math.abs(row[i]!) < 1e-12 ? 0 : row[n]! / row[i]!));
}

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

/** Game-block seed distinct from the action seed so the two blocks never collide. */
const GAME_FEATURE_SEED = 0x85ebca6b;

export function trainHead(
  rows: readonly TrainingRow[],
  meta: { headId: string; rubric: string; axis: string },
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

  if (rows.length < 4) throw new Error(`Insufficient training rows: ${rows.length}`);
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

// ─── L3 bake-off: shared (game-featured) vs per-game reflex_value heads ──────

const brierOn = (
  score: (embedding: Float32Array, action: string, game?: string) => number,
  rows: readonly TrainingRow[]
): number =>
  meanBrierOf(
    rows,
    (row) => score(row.embedding, row.action, row.game),
    (row) => clamp01(row.target)
  );

/** Inference head from a trained model — round-trips through the real artifact/scoring path. */
const toHead = (model: TrainedHeadModel): TrainedLinearHead =>
  TrainedLinearHead.fromBundle(exportArtifacts(model));

export interface SharedHeadBakeOffOptions extends TrainingOptions {
  /** Hashed game dims for the shared arm (per-game arm always trains at 0). */
  gameFeatureDim?: number;
}

export interface SharedHeadBakeOffResult {
  shared: TrainedHeadModel;
  perGame: Record<string, TrainedHeadModel>;
  /** Held-out Brier per domain on the *same* holdout rows for both arms. */
  scores: Record<string, { shared: number; perGame: number }>;
  /** Shared is adopted only if it does not lose on any domain (TODO19 L3 policy). */
  verdict: 'shared' | 'per-game';
}

/**
 * L3 (TODO19): train one shared `reflex_value` head across all registry games
 * (with a dense hashed `game` feature block) against one head per game, and
 * compare held-out Brier on identical per-game holdout splits. Deterministic.
 */
export function bakeOffSharedHead(
  rows: readonly TrainingRow[],
  meta: { headId: string; rubric: string; axis: string },
  options: SharedHeadBakeOffOptions = {}
): SharedHeadBakeOffResult {
  if (rows.some((row) => !row.game)) throw new Error('Bake-off rows must carry a `game` tag');
  const byGame = groupBy(rows, (row) => row.game!);
  if (byGame.size < 2) throw new Error(`Bake-off requires ≥2 games, got ${byGame.size}`);

  const rng = mulberry32(options.seed ?? 42);
  // One map, not a train/holdout pair: each game contributes one split, and a
  // shared `rng` makes the iteration order part of the result — so this stays a
  // `Map`, whose order is insertion order. An object would reorder integer-like
  // game names and silently reshuffle which rows land in which half.
  const splits = new Map<string, { holdout: TrainingRow[]; train: TrainingRow[] }>();
  for (const [game, gameRows] of byGame) {
    splits.set(game, holdoutSplit(gameRows, options.holdoutFraction ?? 0.2, rng));
  }

  const pooledTrain = [...splits.values()].flatMap((split) => split.train);
  const shared = trainHead(pooledTrain, meta, {
    ...options,
    gameFeatureDim: options.gameFeatureDim ?? 8,
  });
  const perGame: Record<string, TrainedHeadModel> = {};
  const scores: SharedHeadBakeOffResult['scores'] = {};
  let sharedWinsAll = true;
  for (const [game, split] of splits) {
    perGame[game] = trainHead(split.train, meta, {
      ...options,
      gameFeatureDim: 0,
      seed: (options.seed ?? 42) ^ game.length,
    });
    const sharedHead = toHead(shared);
    const gameHead = toHead(perGame[game]!);
    const sharedBrier = brierOn((e, a) => sharedHead.score(e, a, game), split.holdout);
    const perGameBrier = brierOn((e, a) => gameHead.score(e, a), split.holdout);
    scores[game] = { shared: sharedBrier, perGame: perGameBrier };
    if (sharedBrier > perGameBrier) sharedWinsAll = false;
  }
  return { shared, perGame, scores, verdict: sharedWinsAll ? 'shared' : 'per-game' };
}

/** Parameters as bytes: the vector, then the bias as a trailing f32 — the one
 *  layout the weight blob, the WASM module and the digest all agree on. */
function weightsBytes(weights: Float32Array, bias: number): Buffer {
  const biasBuf = Buffer.alloc(4);
  biasBuf.writeFloatLE(bias);
  return Buffer.concat([Buffer.from(weights.buffer, weights.byteOffset, weights.byteLength), biasBuf]);
}

const digestWeights = (weights: Float32Array, bias: number): string =>
  sha256Prefixed(weightsBytes(weights, bias));

// ─── Artifacts (docs/system-one-distillation-runner.md contract) ─────────────

export interface HeadArtifactBundle {
  config: HeadArtifactConfig;
  weightsBytes: Buffer;
  modelDigest: string;
}

export interface HeadArtifactConfig extends HeadGeometry {
  mean: number[];
  std: number[];
  encoderDigest: string;
  weightsDigest: string;
  modelDigest: string;
}

export function exportArtifacts(model: TrainedHeadModel): HeadArtifactBundle {
  const encoderId = encoderDigest(model.encoder.modelId, model.encoder.dimension);
  const modelDigest = composeModelDigest(encoderId, model.weightsDigest);
  const config: HeadArtifactConfig = {
    ...geometryOf(model),
    mean: [...model.mean],
    std: [...model.std],
    encoderDigest: encoderId,
    weightsDigest: model.weightsDigest,
    modelDigest,
  };
  return { config, weightsBytes: weightsBytes(model.weights, model.bias), modelDigest };
}

export async function writeHeadArtifacts(
  model: TrainedHeadModel,
  outDir: string
): Promise<HeadArtifactBundle> {
  const bundle = exportArtifacts(model);
  await ensureDir(outDir);
  await Promise.all([
    writeJsonFile(join(outDir, 'config.json'), bundle.config),
    fs.writeFile(join(outDir, 'weights.bin'), bundle.weightsBytes),
    fs.writeFile(join(outDir, 'MODEL_DIGEST'), bundle.modelDigest),
  ]);
  return bundle;
}

// ─── Sandboxed head (trained weights behind the digest-pinned runtime) ───────

export class TrainedLinearHead implements JudgmentHead {
  readonly rubric: RubricId;
  readonly axis: CognitiveAxis;
  readonly fitted = true as const;
  readonly modelDigest: string;
  #config: HeadArtifactConfig;
  #weights: Float32Array;
  #bias: number;

  constructor(config: HeadArtifactConfig, weightsBytes: Buffer, modelDigest: string) {
    this.#config = config;
    this.rubric = config.rubric as RubricId;
    this.axis = config.axis as CognitiveAxis;
    this.modelDigest = modelDigest;
    const floats = new Float32Array(
      weightsBytes.buffer.slice(
        weightsBytes.byteOffset,
        weightsBytes.byteOffset + weightsBytes.byteLength - 4
      )
    );
    this.#weights = floats;
    this.#bias = weightsBytes.readFloatLE(weightsBytes.byteLength - 4);
  }

  static fromBundle(bundle: HeadArtifactBundle): TrainedLinearHead {
    return new TrainedLinearHead(bundle.config, bundle.weightsBytes, bundle.modelDigest);
  }

  score(embedding: Float32Array, action: string, game?: string): number {
    const { mean, std, gameFeatureDim } = this.#config;
    const weights = this.#weights;
    const actionBlock =
      this.#config.actionFeatureDim > 0 ? actionFeatures(action, this.#config.embeddingDim) : null;
    const gameBlock =
      gameFeatureDim > 0 && game ? actionFeatures(game, gameFeatureDim, GAME_FEATURE_SEED) : null;
    let z = this.#bias;
    for (let i = 0; i < this.#config.embeddingDim; i++) {
      const f = actionBlock ? embedding[i]! * actionBlock[i]! : embedding[i]!;
      z += (weights[i]! * (f - mean[i]!)) / std[i]!;
    }
    for (let i = 0; i < gameFeatureDim; i++) {
      const j = this.#config.embeddingDim + i;
      z += (weights[j]! * ((gameBlock?.[i] ?? 0) - mean[j]!)) / std[j]!;
    }
    const clamped = this.#config.kind === 'logistic' ? sigmoid(z) : clamp01(z);
    return clamped;
  }

  async evaluate(embedding: Float32Array, query: JudgmentQuery) {
    const action = parseActionFromInstruction(query.instruction);
    const game = query.instruction.match(/game (\S+)/)?.[1];
    return { score: this.score(embedding, action, game), abstained: false };
  }
}

/** Load a trained head bundle, verifying the weights hash against the pinned digest. */
export async function loadHeadArtifacts(
  outDir: string,
  pinnedDigest?: string
): Promise<TrainedLinearHead> {
  const [configRaw, weightsBytes, digestFile] = await Promise.all([
    fs.readFile(join(outDir, 'config.json'), 'utf-8'),
    fs.readFile(join(outDir, 'weights.bin')),
    fs.readFile(join(outDir, 'MODEL_DIGEST'), 'utf-8'),
  ]);
  const config = JSON.parse(configRaw) as HeadArtifactConfig;
  const modelDigest = digestFile.trim();
  const actual = sha256Prefixed(weightsBytes);
  if (actual !== config.weightsDigest) {
    throw new DigestMismatchError(config.weightsDigest, actual);
  }
  if (pinnedDigest && pinnedDigest !== modelDigest) {
    throw new DigestMismatchError(pinnedDigest, modelDigest);
  }
  return new TrainedLinearHead(config, weightsBytes, modelDigest);
}
