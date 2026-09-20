import type { CognitiveAxis, EmbeddingCache, HeadResult, JudgmentHead, JudgmentQuery, RubricId, CalibrationVersion } from '../types.js';
import { createIsotonicCalibrator, type IsotonicCalibrator } from '../calibration.js';
import { getScorer } from '../scoring.js';
import { makeClassifyHead, makeEvaluateHead, type HeadFactoryOptions as FactoryHeadFactoryOptions } from './factory.js';

export interface PerHeadConfig {
  modelDigest: string;
  calibrationVersion: CalibrationVersion;
  abstainThreshold: number;
  enabled: boolean;
}

export type HeadFactoryOptions = FactoryHeadFactoryOptions;

export function createCandidateSelectHead(options: HeadFactoryOptions): JudgmentHead {
  return makeClassifyHead('candidate_select', 'teleological', ['candidate_1', 'candidate_2', 'candidate_3'] as const, options);
}

export function createConflictHead(options: HeadFactoryOptions): JudgmentHead {
  return makeClassifyHead('conflict', 'epistemic', ['support', 'neutral', 'conflict', 'strong-conflict'] as const, options);
}

export function createGroundednessHead(options: HeadFactoryOptions): JudgmentHead {
  return makeEvaluateHead('groundedness', 'epistemic', ['ungrounded', 'weakly-grounded', 'grounded', 'strongly-grounded'] as const, options);
}

export function createAllSynthesisHeads(options: HeadFactoryOptions): Map<RubricId, JudgmentHead> {
  const heads = new Map<RubricId, JudgmentHead>();
  heads.set('candidate_select', createCandidateSelectHead(options));
  heads.set('conflict', createConflictHead(options));
  heads.set('groundedness', createGroundednessHead(options));
  return heads;
}