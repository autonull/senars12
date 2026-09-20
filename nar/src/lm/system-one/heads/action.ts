import type { CognitiveAxis, EmbeddingCache, HeadResult, JudgmentHead, JudgmentQuery, RubricId, CalibrationVersion } from '../types.js';
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

function makeClassifyHead(
  rubric: RubricId,
  space: readonly string[],
  options: HeadFactoryOptions
): JudgmentHead {
  const { calibrationVersion, abstainThreshold, perHeadConfig } = options;
  const headConfig = perHeadConfig?.[rubric];
  const effectiveCalibrationVersion = headConfig?.calibrationVersion ?? calibrationVersion;
  const effectiveAbstainThreshold = headConfig?.abstainThreshold ?? abstainThreshold;
  const enabled = headConfig?.enabled ?? true;

  const calibrator = createIsotonicCalibrator(effectiveCalibrationVersion, rubric);
  const scorer = getScorer(rubric);

  return {
    rubric,
    axis: 'teleological',
    space,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      if (!enabled) {
        return {
          score: 0,
          distribution: space.map((opt) => ({ option: opt, p: 1 / space.length })),
          abstained: true,
          abstainReason: 'out-of-domain',
        };
      }

      const rawScore = scorer(embedding, query);
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < effectiveAbstainThreshold;

      if (abstained) {
        return {
          score: calibratedScore,
          distribution: space.map((opt) => ({ option: opt, p: 1 / space.length })),
          abstained: true,
          abstainReason: 'low-confidence',
        };
      }

      const dominantIdx = Math.floor(calibratedScore * space.length) % space.length;
      const dist = space.map((opt, i) => ({
        option: opt,
        p: i === dominantIdx ? calibratedScore : (1 - calibratedScore) / Math.max(1, space.length - 1),
      }));
      return { score: calibratedScore, distribution: dist, abstained: false };
    },
  };
}

function makeEvaluateHead(
  rubric: RubricId,
  levels: readonly string[],
  options: HeadFactoryOptions
): JudgmentHead {
  const { calibrationVersion, abstainThreshold, perHeadConfig } = options;
  const headConfig = perHeadConfig?.[rubric];
  const effectiveCalibrationVersion = headConfig?.calibrationVersion ?? calibrationVersion;
  const effectiveAbstainThreshold = headConfig?.abstainThreshold ?? abstainThreshold;
  const enabled = headConfig?.enabled ?? true;

  const calibrator = createIsotonicCalibrator(effectiveCalibrationVersion, rubric);
  const scorer = getScorer(rubric);

  return {
    rubric,
    axis: 'teleological',
    levels,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      if (!enabled) {
        return { score: 0, abstained: true, abstainReason: 'out-of-domain' };
      }

      const rawScore = scorer(embedding, query);
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < effectiveAbstainThreshold;
      return { score: calibratedScore, abstained, abstainReason: abstained ? 'low-confidence' : undefined };
    },
  };
}

export function createToolDispatchHead(options: HeadFactoryOptions): JudgmentHead {
  const space = ['none', 'low', 'medium', 'high', 'critical'] as const;
  return makeClassifyHead('tool_dispatch', space, options);
}

export function createRiskHead(options: HeadFactoryOptions): JudgmentHead {
  const space = ['none', 'low', 'medium', 'high', 'critical'] as const;
  return makeClassifyHead('risk', space, options);
}

export function createFeasibilityHead(options: HeadFactoryOptions): JudgmentHead {
  const levels = ['impossible', 'unlikely', 'possible', 'likely', 'certain'] as const;
  return makeEvaluateHead('feasibility', levels, options);
}

export function createStrategyHead(options: HeadFactoryOptions): JudgmentHead {
  const space = ['explore', 'exploit', 'deliberate', 'delegate'] as const;
  return makeClassifyHead('strategy', space, options);
}

export function createReflexValueHead(options: HeadFactoryOptions): JudgmentHead {
  const levels = ['very-low', 'low', 'medium', 'high', 'very-high'] as const;
  return makeEvaluateHead('reflex_value', levels, options);
}

export function createAllActionHeads(options: HeadFactoryOptions): Map<RubricId, JudgmentHead> {
  const heads = new Map<RubricId, JudgmentHead>();
  heads.set('tool_dispatch', createToolDispatchHead(options));
  heads.set('risk', createRiskHead(options));
  heads.set('feasibility', createFeasibilityHead(options));
  heads.set('strategy', createStrategyHead(options));
  heads.set('reflex_value', createReflexValueHead(options));
  return heads;
}