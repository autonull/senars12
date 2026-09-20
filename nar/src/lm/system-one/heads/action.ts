import type { CognitiveAxis, EmbeddingCache, HeadResult, JudgmentHead, JudgmentQuery, RubricId, CalibrationVersion } from '../types.js';
import { createIsotonicCalibrator, type IsotonicCalibrator } from '../calibration.js';

export interface HeadFactoryOptions {
  calibrationVersion: CalibrationVersion;
  embeddingCache: EmbeddingCache;
  abstainThreshold: number;
}

export function createToolDispatchHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'tool_dispatch');
  const space = ['none', 'low', 'medium', 'high', 'critical'] as const;

  return {
    rubric: 'tool_dispatch',
    axis: 'teleological',
    space,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      const rawScore = Math.random();
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < abstainThreshold;
      return { score: calibratedScore, distribution: space.map((opt, i) => ({ option: opt, p: i === 0 ? 1 : 0 })), abstained, abstainReason: abstained ? 'low-confidence' : undefined };
    },
  };
}

export function createRiskHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'risk');
  const space = ['none', 'low', 'medium', 'high', 'critical'] as const;

  return {
    rubric: 'risk',
    axis: 'teleological',
    space,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      const rawScore = Math.random();
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < abstainThreshold;
      return { score: calibratedScore, distribution: space.map((opt, i) => ({ option: opt, p: i === 0 ? 1 : 0 })), abstained, abstainReason: abstained ? 'low-confidence' : undefined };
    },
  };
}

export function createFeasibilityHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'feasibility');
  const levels = ['impossible', 'unlikely', 'possible', 'likely', 'certain'] as const;

  return {
    rubric: 'feasibility',
    axis: 'teleological',
    levels,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      const rawScore = Math.random();
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < abstainThreshold;
      return { score: calibratedScore, abstained, abstainReason: abstained ? 'low-confidence' : undefined };
    },
  };
}

export function createStrategyHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'strategy');
  const space = ['explore', 'exploit', 'deliberate', 'delegate'] as const;

  return {
    rubric: 'strategy',
    axis: 'teleological',
    space,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      const rawScore = Math.random();
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < abstainThreshold;
      return { score: calibratedScore, distribution: space.map((opt, i) => ({ option: opt, p: 1 / space.length })), abstained, abstainReason: abstained ? 'low-confidence' : undefined };
    },
  };
}

export function createReflexValueHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'reflex_value');
  const levels = ['very-low', 'low', 'medium', 'high', 'very-high'] as const;

  return {
    rubric: 'reflex_value',
    axis: 'teleological',
    levels,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      const rawScore = Math.random();
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < abstainThreshold;
      return { score: calibratedScore, abstained, abstainReason: abstained ? 'low-confidence' : undefined };
    },
  };
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