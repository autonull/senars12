export type { TermFilter } from '../types/index';
export type { Answer, QueryResult } from './api';
export { createQueryAPI, QueryAPI } from './api';
export type { MemoryQueryFilter, MemoryQueryOptions, MemoryResult } from './memory-query';
export type { RelevanceOptions } from './relevance';
export {
  byRelevance,
  relevanceScore,
  RELEVANCE_CONTAINMENT,
  RELEVANCE_EXACT,
} from './relevance';
export { episodeQualitySurface, MemoryQuery } from './memory-query';
export type { DerivationNode, DerivationTree, ExplainResult, TraceResult } from './trace';
export { createReasoningTrace, ReasoningTrace } from './trace';
