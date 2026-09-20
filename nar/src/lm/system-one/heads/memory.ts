import type { CognitiveAxis, EmbeddingCache, HeadResult, JudgmentHead, JudgmentQuery, RubricId, CalibrationVersion } from '../types.js';
import { createIsotonicCalibrator, type IsotonicCalibrator } from '../calibration.js';

export interface HeadFactoryOptions {
  calibrationVersion: CalibrationVersion;
  embeddingCache: EmbeddingCache;
  abstainThreshold: number;
}

export function createRelevanceHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'relevance');
  const levels = ['irrelevant', 'tangential', 'relevant', 'highly-relevant'] as const;

  return {
    rubric: 'relevance',
    axis: 'epistemic',
    levels,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      const rawScore = Math.random();
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < abstainThreshold;
      return { score: calibratedScore, abstained, abstainReason: abstained ? 'low-confidence' : undefined };
    },
  };
}

export function createEpisodicMatchHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'episodic_match');
  const levels = ['no-match', 'weak-match', 'match', 'strong-match'] as const;

  return {
    rubric: 'episodic_match',
    axis: 'epistemic',
    levels,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      const rawScore = Math.random();
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < abstainThreshold;
      return { score: calibratedScore, abstained, abstainReason: abstained ? 'low-confidence' : undefined };
    },
  };
}

export function createNoveltyHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'novelty');
  const levels = ['known', 'slightly-novel', 'novel', 'highly-novel'] as const;

  return {
    rubric: 'novelty',
    axis: 'epistemic',
    levels,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      const rawScore = Math.random();
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < abstainThreshold;
      return { score: calibratedScore, abstained, abstainReason: abstained ? 'low-confidence' : undefined };
    },
  };
}

export function createAllMemoryHeads(options: HeadFactoryOptions): Map<RubricId, JudgmentHead> {
  const heads = new Map<RubricId, JudgmentHead>();
  heads.set('relevance', createRelevanceHead(options));
  heads.set('episodic_match', createEpisodicMatchHead(options));
  heads.set('novelty', createNoveltyHead(options));
  return heads;
}