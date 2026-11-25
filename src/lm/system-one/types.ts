/**
 * System One types — the vocabulary shared by training, inference and distillation.
 *
 * A shim rather than a move in effect: the layer's importers keep the path they
 * had, and the *core* can name the same committed types without importing
 * anything under `lm/` — which is the condition A2's gate makes structural and
 * §5.11's "typed in the layer's own vocabulary" needs to be satisfiable at all.
 */
export * from '../../decision/types';
import type { RubricId, CognitiveAxis } from '../../decision/types';

// ─── Training data ────────────────────────────────────────────────────────────

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

// ─── Trainer config ───────────────────────────────────────────────────────────

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
 * Who a head is. Named once because three signatures restated it as
 * `{ headId: string; rubric: string; axis: string }`, and *strings* let a trainer
 * build a head for a rubric and an axis that no head has — the config.json it then
 * wrote claimed a judgment head over neither a belief nor a goal, and loading it
 * back required two `as` casts because the loader could not tell.
 */
export interface HeadIdentity {
  headId: string;
  rubric: RubricId;
  axis: CognitiveAxis;
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
export interface HeadGeometry extends HeadIdentity {
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

// ─── L3 bake-off ──────────────────────────────────────────────────────────────

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

// ─── Artifacts ────────────────────────────────────────────────────────────────

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