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

export function createTaskTypeHead(options: HeadFactoryOptions): JudgmentHead {
  return makeClassifyHead('task_type', 'epistemic', ['belief', 'goal', 'question', 'command'] as const, options);
}

export function createIllocutionHead(options: HeadFactoryOptions): JudgmentHead {
  return makeClassifyHead('illocution', 'epistemic', ['assert', 'query', 'command', 'promise', 'express'] as const, options);
}

export function createInjectionHead(options: HeadFactoryOptions): JudgmentHead {
  return makeEvaluateHead('injection', 'epistemic', ['none', 'low', 'medium', 'high', 'critical'] as const, options);
}

export function createAmbiguityHead(options: HeadFactoryOptions): JudgmentHead {
  return makeEvaluateHead('ambiguity', 'epistemic', ['clear', 'slight', 'moderate', 'high', 'severe'] as const, options);
}

export function createTenseHead(options: HeadFactoryOptions): JudgmentHead {
  return makeClassifyHead('tense', 'epistemic', ['past', 'present', 'future', 'timeless'] as const, options);
}

export function createSourceQualityHead(options: HeadFactoryOptions): JudgmentHead {
  return makeClassifyHead('source_quality', 'epistemic', ['PRIMARY', 'SECONDARY', 'GENERAL', 'TERTIARY', 'LLM_PRIOR', 'PEER_AGENT'] as const, options);
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