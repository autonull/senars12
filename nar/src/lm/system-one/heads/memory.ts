import type { CognitiveAxis, EmbeddingCache, HeadResult, JudgmentHead, JudgmentQuery, RubricId, CalibrationVersion } from '../types.js';
import { createIsotonicCalibrator, type IsotonicCalibrator } from '../calibration.js';
import { getScorer } from '../scoring.js';

export interface HeadFactoryOptions {
  calibrationVersion: CalibrationVersion;
  embeddingCache: EmbeddingCache;
  abstainThreshold: number;
}

function makeEvaluateHead(
  rubric: RubricId,
  axis: CognitiveAxis,
  levels: readonly string[],
  options: HeadFactoryOptions
): JudgmentHead {
  const { calibrationVersion, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, rubric);
  const scorer = getScorer(rubric);

  return {
    rubric,
    axis,
    levels,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      const rawScore = scorer(embedding, query);
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < abstainThreshold;
      return { score: calibratedScore, abstained, abstainReason: abstained ? 'low-confidence' : undefined };
    },
  };
}

export function createRelevanceHead(options: HeadFactoryOptions): JudgmentHead {
  const levels = ['irrelevant', 'tangential', 'relevant', 'highly-relevant'] as const;
  return makeEvaluateHead('relevance', 'epistemic', levels, options);
}

export function createEpisodicMatchHead(options: HeadFactoryOptions): JudgmentHead {
  const levels = ['no-match', 'weak-match', 'match', 'strong-match'] as const;
  return makeEvaluateHead('episodic_match', 'epistemic', levels, options);
}

export function createNoveltyHead(options: HeadFactoryOptions): JudgmentHead {
  const levels = ['known', 'slightly-novel', 'novel', 'highly-novel'] as const;
  return makeEvaluateHead('novelty', 'epistemic', levels, options);
}

export function createAllMemoryHeads(options: HeadFactoryOptions): Map<RubricId, JudgmentHead> {
  const heads = new Map<RubricId, JudgmentHead>();
  heads.set('relevance', createRelevanceHead(options));
  heads.set('episodic_match', createEpisodicMatchHead(options));
  heads.set('novelty', createNoveltyHead(options));
  return heads;
}