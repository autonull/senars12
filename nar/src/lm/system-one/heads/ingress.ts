import type { CognitiveAxis, EmbeddingCache, HeadResult, JudgmentHead, JudgmentQuery, RubricId, CalibrationVersion } from '../types.js';
import { createIsotonicCalibrator, type IsotonicCalibrator } from '../calibration.js';

export interface HeadFactoryOptions {
  calibrationVersion: CalibrationVersion;
  embeddingCache: EmbeddingCache;
  abstainThreshold: number;
}

export function createTaskTypeHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'task_type');
  const space = ['belief', 'goal', 'question', 'command'] as const;

  return {
    rubric: 'task_type',
    axis: 'epistemic',
    space,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery): Promise<HeadResult> => {
      const rawScore = computeTaskTypeScore(embedding, query);
      const calibratedScore = calibrator.calibrate(rawScore);

      if (calibratedScore < abstainThreshold) {
        return {
          score: calibratedScore,
          distribution: space.map((opt, i) => ({ option: opt, p: i === 0 ? 0.25 : 0.25 })),
          abstained: true,
          abstainReason: 'low-confidence',
        };
      }

      const dominantIdx = Math.floor(calibratedScore * space.length) % space.length;
      const dist = space.map((opt, i) => ({
        option: opt,
        p: i === dominantIdx ? calibratedScore : (1 - calibratedScore) / (space.length - 1),
      }));

      return { score: calibratedScore, distribution: dist, abstained: false };
    },
  };
}

export function createIllocutionHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'illocution');
  const space = ['assert', 'query', 'command', 'promise', 'express'] as const;

  return {
    rubric: 'illocution',
    axis: 'epistemic',
    space,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery) => {
      const rawScore = computeIllocutionScore(embedding, query);
      const calibratedScore = calibrator.calibrate(rawScore);

      if (calibratedScore < abstainThreshold) {
        return { score: calibratedScore, distribution: space.map((opt, i) => ({ option: opt, p: 1 / space.length })), abstained: true, abstainReason: 'low-confidence' };
      }

      const dominantIdx = Math.floor(calibratedScore * space.length) % space.length;
      const dist = space.map((opt, i) => ({ option: opt, p: i === dominantIdx ? calibratedScore : (1 - calibratedScore) / (space.length - 1) }));
      return { score: calibratedScore, distribution: dist, abstained: false };
    },
  };
}

export function createInjectionHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'injection');
  const levels = ['none', 'low', 'medium', 'high', 'critical'] as const;

  return {
    rubric: 'injection',
    axis: 'epistemic',
    levels,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery) => {
      const rawScore = computeInjectionScore(embedding, query);
      const calibratedScore = calibrator.calibrate(rawScore);

      const abstained = calibratedScore < abstainThreshold;
      return {
        score: calibratedScore,
        abstained,
        abstainReason: abstained ? 'low-confidence' : undefined,
      };
    },
  };
}

export function createAmbiguityHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'ambiguity');
  const levels = ['clear', 'slight', 'moderate', 'high', 'severe'] as const;

  return {
    rubric: 'ambiguity',
    axis: 'epistemic',
    levels,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery) => {
      const rawScore = computeAmbiguityScore(embedding, query);
      const calibratedScore = calibrator.calibrate(rawScore);

      const abstained = calibratedScore < abstainThreshold;
      return {
        score: calibratedScore,
        abstained,
        abstainReason: abstained ? 'low-confidence' : undefined,
      };
    },
  };
}

export function createTenseHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'tense');
  const space = ['past', 'present', 'future', 'timeless'] as const;

  return {
    rubric: 'tense',
    axis: 'epistemic',
    space,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery) => {
      const rawScore = computeTenseScore(embedding, query);
      const calibratedScore = calibrator.calibrate(rawScore);

      if (calibratedScore < abstainThreshold) {
        return { score: calibratedScore, distribution: space.map((opt, i) => ({ option: opt, p: 1 / space.length })), abstained: true, abstainReason: 'low-confidence' };
      }

      const dominantIdx = Math.floor(calibratedScore * space.length) % space.length;
      const dist = space.map((opt, i) => ({ option: opt, p: i === dominantIdx ? calibratedScore : (1 - calibratedScore) / (space.length - 1) }));
      return { score: calibratedScore, distribution: dist, abstained: false };
    },
  };
}

export function createSourceQualityHead(options: HeadFactoryOptions): JudgmentHead {
  const { calibrationVersion, embeddingCache, abstainThreshold } = options;
  const calibrator = createIsotonicCalibrator(calibrationVersion, 'source_quality');
  const space = ['PRIMARY', 'SECONDARY', 'GENERAL', 'TERTIARY', 'LLM_PRIOR', 'PEER_AGENT'] as const;

  return {
    rubric: 'source_quality',
    axis: 'epistemic',
    space,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery) => {
      const rawScore = computeSourceQualityScore(embedding, query);
      const calibratedScore = calibrator.calibrate(rawScore);

      if (calibratedScore < abstainThreshold) {
        return { score: calibratedScore, distribution: space.map((opt, i) => ({ option: opt, p: 1 / space.length })), abstained: true, abstainReason: 'low-confidence' };
      }

      const dominantIdx = Math.floor(calibratedScore * space.length) % space.length;
      const dist = space.map((opt, i) => ({ option: opt, p: i === dominantIdx ? calibratedScore : (1 - calibratedScore) / (space.length - 1) }));
      return { score: calibratedScore, distribution: dist, abstained: false };
    },
  };
}

function computeTaskTypeScore(embedding: Float32Array, query: JudgmentQuery): number {
  let hash = 0;
  for (let i = 0; i < Math.min(embedding.length, 32); i++) {
    const val = embedding[i] ?? 0;
    hash = ((hash << 5) - hash + Math.floor(val * 1000)) | 0;
  }
  const textHash = query.instruction.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  return Math.abs(hash + textHash) % 10000 / 10000;
}

function computeIllocutionScore(embedding: Float32Array, query: JudgmentQuery): number {
  let hash = 0;
  for (let i = 0; i < Math.min(embedding.length, 32); i++) {
    const val = embedding[i] ?? 0;
    hash = ((hash << 5) - hash + Math.floor(val * 1000 + 17)) | 0;
  }
  const textHash = query.instruction.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0) + 3) | 0, 0);
  return Math.abs(hash + textHash) % 10000 / 10000;
}

function computeInjectionScore(embedding: Float32Array, query: JudgmentQuery): number {
  let hash = 0;
  for (let i = 0; i < Math.min(embedding.length, 32); i++) {
    const val = embedding[i] ?? 0;
    hash = ((hash << 5) - hash + Math.floor(val * 1000 + 31)) | 0;
  }
  const textHash = query.instruction.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0) + 7) | 0, 0);
  const injectionPatterns = ['ignore', 'bypass', 'override', 'inject', 'system:', 'prompt:', 'admin:'];
  const hasInjectionPattern = injectionPatterns.some(p => query.instruction.toLowerCase().includes(p));
  const base = Math.abs(hash + textHash) % 10000 / 10000;
  return hasInjectionPattern ? Math.min(0.9, base + 0.4) : base * 0.3;
}

function computeAmbiguityScore(embedding: Float32Array, query: JudgmentQuery): number {
  let hash = 0;
  for (let i = 0; i < Math.min(embedding.length, 32); i++) {
    const val = embedding[i] ?? 0;
    hash = ((hash << 5) - hash + Math.floor(val * 1000 + 13)) | 0;
  }
  const textHash = query.instruction.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0) + 11) | 0, 0);
  const ambiguityPatterns = ['maybe', 'perhaps', 'could be', 'might', 'uncertain', 'unclear'];
  const hasAmbiguityPattern = ambiguityPatterns.some(p => query.instruction.toLowerCase().includes(p));
  const base = Math.abs(hash + textHash) % 10000 / 10000;
  return hasAmbiguityPattern ? Math.min(0.8, base + 0.3) : base * 0.4;
}

function computeTenseScore(embedding: Float32Array, query: JudgmentQuery): number {
  let hash = 0;
  for (let i = 0; i < Math.min(embedding.length, 32); i++) {
    const val = embedding[i] ?? 0;
    hash = ((hash << 5) - hash + Math.floor(val * 1000 + 19)) | 0;
  }
  const textHash = query.instruction.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0) + 23) | 0, 0);
  return Math.abs(hash + textHash) % 10000 / 10000;
}

function computeSourceQualityScore(embedding: Float32Array, query: JudgmentQuery): number {
  let hash = 0;
  for (let i = 0; i < Math.min(embedding.length, 32); i++) {
    const val = embedding[i] ?? 0;
    hash = ((hash << 5) - hash + Math.floor(val * 1000 + 29)) | 0;
  }
  const textHash = query.instruction.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0) + 19) | 0, 0);
  return Math.abs(hash + textHash) % 10000 / 10000;
}

export function createAllIngressHeads(options: HeadFactoryOptions): Map<RubricId, JudgmentHead> {
  const heads = new Map<RubricId, JudgmentHead>();
  heads.set('task_type', createTaskTypeHead(options));
  heads.set('illocution', createIllocutionHead(options));
  heads.set('injection', createInjectionHead(options));
  heads.set('ambiguity', createAmbiguityHead(options));
  heads.set('tense', createTenseHead(options));
  heads.set('source_quality', createSourceQualityHead(options));
  return heads;
}