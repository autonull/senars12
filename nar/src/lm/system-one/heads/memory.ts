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

export function createRelevanceHead(options: HeadFactoryOptions): JudgmentHead {
  return makeEvaluateHead('relevance', 'epistemic', ['irrelevant', 'tangential', 'relevant', 'highly-relevant'] as const, options);
}

export function createEpisodicMatchHead(options: HeadFactoryOptions): JudgmentHead {
  return makeEvaluateHead('episodic_match', 'epistemic', ['no-match', 'weak-match', 'match', 'strong-match'] as const, options);
}

export function createNoveltyHead(options: HeadFactoryOptions): JudgmentHead {
  return makeEvaluateHead('novelty', 'epistemic', ['known', 'slightly-novel', 'novel', 'highly-novel'] as const, options);
}

export function createAllMemoryHeads(options: HeadFactoryOptions): Map<RubricId, JudgmentHead> {
  const heads = new Map<RubricId, JudgmentHead>();
  heads.set('relevance', createRelevanceHead(options));
  heads.set('episodic_match', createEpisodicMatchHead(options));
  heads.set('novelty', createNoveltyHead(options));
  return heads;
}