/**
 * Memory — episodic memory and retrieval (migrated from @senars/nar/memory and @senars/core/memory).
 */

export { EpisodicMemory } from '@senars/nar/memory/episodic';
export { consolidateEpisodes, type PromotionResult } from '@senars/nar/memory/retrieval-verified';
export { JsonlSessionManager } from '@senars/core/memory';
export type { EpisodeType } from '@senars/nar';
export { ConceptGraph, type ConceptGraphOptions, type CoActivationEdge } from '@senars/nar/memory/ConceptGraph.js';
export { Memory } from '@senars/nar/memory/index.js';
export type { ConceptTaskType, MemoryConfig } from '@senars/nar/memory/index.js';
export { EpisodeConsolidator, symbolicSummary } from '@senars/nar/memory/episode-consolidator.js';
export type { ConsolidationResult, EpisodeConsolidatorOptions } from '@senars/nar/memory/episode-consolidator.js';
export { LinkLayerMemory } from '@senars/nar/memory/associative.js';

// Re-export InMemorySessionManager from util
export { InMemorySessionManager, createSession, abortSession, type SessionStoreOptions } from '@senars/util/memory/in-memory-session-manager.js';
export type { SessionManager, ConversationSession } from '@senars/util/types/memory.js';