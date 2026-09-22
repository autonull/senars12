export * from '../head-specs.js';
export * from './factory.js';

import { createHeadById, createHeadsForGroup } from '../head-specs.js';
import type { JudgmentHead, RubricId } from '../types.js';
import type { HeadFactoryOptions } from './factory.js';

export type { HeadId } from '../head-specs.js';

// Named per-head creators — one-line re-exports over the HEAD_SPECS registry (G1).
export const createTaskTypeHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('task_type', o);
export const createIllocutionHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('illocution', o);
export const createInjectionHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('injection', o);
export const createAmbiguityHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('ambiguity', o);
export const createTenseHead = (o: HeadFactoryOptions): JudgmentHead => createHeadById('tense', o);
export const createSourceQualityHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('source_quality', o);
export const createToolDispatchHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('tool_dispatch', o);
export const createRiskHead = (o: HeadFactoryOptions): JudgmentHead => createHeadById('risk', o);
export const createFeasibilityHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('feasibility', o);
export const createStrategyHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('strategy', o);
export const createReflexValueHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('reflex_value', o);
export const createCandidateSelectHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('candidate_select', o);
export const createConflictHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('conflict', o);
export const createGroundednessHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('groundedness', o);
export const createRelevanceHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('relevance', o);
export const createEpisodicMatchHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('episodic_match', o);
export const createNoveltyHead = (o: HeadFactoryOptions): JudgmentHead =>
  createHeadById('novelty', o);

export const createAllIngressHeads = (o: HeadFactoryOptions): Map<RubricId, JudgmentHead> =>
  createHeadsForGroup('ingress', o);
export const createAllActionHeads = (o: HeadFactoryOptions): Map<RubricId, JudgmentHead> =>
  createHeadsForGroup('action', o);
export const createAllSynthesisHeads = (o: HeadFactoryOptions): Map<RubricId, JudgmentHead> =>
  createHeadsForGroup('synthesis', o);
export const createAllMemoryHeads = (o: HeadFactoryOptions): Map<RubricId, JudgmentHead> =>
  createHeadsForGroup('memory', o);
