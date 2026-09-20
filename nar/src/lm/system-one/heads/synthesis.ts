import type { CognitiveAxis, EmbeddingCache, HeadResult, JudgmentHead, JudgmentQuery, RubricId, CalibrationVersion } from '../types.js';
import { createIsotonicCalibrator, type IsotonicCalibrator } from '../calibration.js';
import { getScorer } from '../scoring.js';

export interface HeadFactoryOptions {
  calibrationVersion: CalibrationVersion;
  embeddingCache: EmbeddingCache;
  abstainThreshold: number;
}

function makeClassifyHead(
  rubric: RubricId,
  axis: CognitiveAxis,
  space: readonly string[],
  options: HeadFactoryOptions
): JudgmentHead {
  const { calibrationVersion, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, rubric);
  const scorer = getScorer(rubric);

  return {
    rubric,
    axis,
    space,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      const rawScore = scorer(embedding, query);
      const calibratedScore = calibrator.calibrate(rawScore);
      const abstained = calibratedScore < abstainThreshold;

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

export function createCandidateSelectHead(options: HeadFactoryOptions): JudgmentHead {
  const space = ['candidate_1', 'candidate_2', 'candidate_3'] as const;
  return makeClassifyHead('candidate_select', 'teleological', space, options);
}

export function createConflictHead(options: HeadFactoryOptions): JudgmentHead {
  const space = ['support', 'neutral', 'conflict', 'strong-conflict'] as const;
  return makeClassifyHead('conflict', 'epistemic', space, options);
}

export function createGroundednessHead(options: HeadFactoryOptions): JudgmentHead {
  const levels = ['ungrounded', 'weakly-grounded', 'grounded', 'strongly-grounded'] as const;
  return makeEvaluateHead('groundedness', 'epistemic', levels, options);
}

export function createAllSynthesisHeads(options: HeadFactoryOptions): Map<RubricId, JudgmentHead> {
  const heads = new Map<RubricId, JudgmentHead>();
  heads.set('candidate_select', createCandidateSelectHead(options));
  heads.set('conflict', createConflictHead(options));
  heads.set('groundedness', createGroundednessHead(options));
  return heads;
}