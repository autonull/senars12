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

export function createToolDispatchHead(options: HeadFactoryOptions): JudgmentHead {
  return makeClassifyHead('tool_dispatch', 'teleological', ['none', 'low', 'medium', 'high', 'critical'] as const, options);
}

export function createRiskHead(options: HeadFactoryOptions): JudgmentHead {
  return makeClassifyHead('risk', 'teleological', ['none', 'low', 'medium', 'high', 'critical'] as const, options);
}

export function createFeasibilityHead(options: HeadFactoryOptions): JudgmentHead {
  return makeEvaluateHead('feasibility', 'teleological', ['impossible', 'unlikely', 'possible', 'likely', 'certain'] as const, options);
}

export function createStrategyHead(options: HeadFactoryOptions): JudgmentHead {
  return makeClassifyHead('strategy', 'teleological', ['explore', 'exploit', 'deliberate', 'delegate'] as const, options);
}

export function createReflexValueHead(options: HeadFactoryOptions): JudgmentHead {
  return makeEvaluateHead('reflex_value', 'teleological', ['very-low', 'low', 'medium', 'high', 'very-high'] as const, options);
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