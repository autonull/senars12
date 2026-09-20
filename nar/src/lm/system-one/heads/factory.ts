import type {
  CognitiveAxis,
  EmbeddingCache,
  HeadResult,
  JudgmentHead,
  JudgmentQuery,
  RubricId,
  CalibrationVersion,
} from '../types.js';
import { createIsotonicCalibrator, type IsotonicCalibrator } from '../calibration.js';
import { getScorer } from '../scoring.js';

export interface PerHeadConfig {
  modelDigest: string;
  calibrationVersion: CalibrationVersion;
  abstainThreshold: number;
  enabled: boolean;
}

export interface HeadFactoryOptions {
  calibrationVersion: CalibrationVersion;
  embeddingCache: EmbeddingCache;
  abstainThreshold: number;
  perHeadConfig?: Record<string, PerHeadConfig>;
}

interface HeadSpec {
  rubric: RubricId;
  axis: CognitiveAxis;
  space?: readonly string[];
  levels?: readonly string[];
  kind: 'classify' | 'evaluate';
}

function resolveHeadConfig(rubric: RubricId, options: HeadFactoryOptions) {
  const headConfig = options.perHeadConfig?.[rubric];
  return {
    calibrationVersion: headConfig?.calibrationVersion ?? options.calibrationVersion,
    abstainThreshold: headConfig?.abstainThreshold ?? options.abstainThreshold,
    enabled: headConfig?.enabled ?? true,
  };
}

export function makeHead(
  spec: HeadSpec,
  options: HeadFactoryOptions
): JudgmentHead {
  const { calibrationVersion, abstainThreshold, enabled } = resolveHeadConfig(spec.rubric, options);
  const calibrator = createIsotonicCalibrator(calibrationVersion, spec.rubric);
  const scorer = getScorer(spec.rubric);

  const isClassify = spec.kind === 'classify';
  const space = spec.space ?? [];
  const levels = spec.levels ?? [];

  return {
    rubric: spec.rubric,
    axis: spec.axis,
    space: isClassify ? space : undefined,
    levels: !isClassify ? levels : undefined,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      if (!enabled) {
        return {
          score: 0,
          distribution: isClassify ? space.map((opt) => ({ option: opt, p: 1 / Math.max(1, space.length) })) : undefined,
          abstained: true,
          abstainReason: 'out-of-domain',
        };
      }

      const rawScore = scorer(embedding, query);
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < abstainThreshold;

      if (abstained) {
        return {
          score: calibratedScore,
          distribution: isClassify ? space.map((opt) => ({ option: opt, p: 1 / Math.max(1, space.length) })) : undefined,
          abstained: true,
          abstainReason: 'low-confidence',
        };
      }

      if (isClassify) {
        const dominantIdx = Math.floor(calibratedScore * space.length) % space.length;
        const dist = space.map((opt, i) => ({
          option: opt,
          p: i === dominantIdx ? calibratedScore : (1 - calibratedScore) / Math.max(1, space.length - 1),
        }));
        return { score: calibratedScore, distribution: dist, abstained: false };
      }

      return { score: calibratedScore, abstained: false };
    },
  };
}

export function makeClassifyHead(
  rubric: RubricId,
  axis: CognitiveAxis,
  space: readonly string[],
  options: HeadFactoryOptions
): JudgmentHead {
  return makeHead({ rubric, axis, space, kind: 'classify' }, options);
}

export function makeEvaluateHead(
  rubric: RubricId,
  axis: CognitiveAxis,
  levels: readonly string[],
  options: HeadFactoryOptions
): JudgmentHead {
  return makeHead({ rubric, axis, levels, kind: 'evaluate' }, options);
}