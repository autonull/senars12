/**
 * Memory — episodic memory and retrieval (migrated from @senars/nar/memory and @senars/core/memory).
 */

export { EpisodicMemory } from '@senars/nar/memory/episodic';
export { consolidateEpisodes, type PromotionResult } from '@senars/nar/memory/retrieval-verified';
export { JsonlSessionManager } from '@senars/core/memory';
export type { EpisodeType } from '@senars/nar';

// Re-export InMemorySessionManager from util
export { InMemorySessionManager, createSession, abortSession, type SessionStoreOptions } from '@senars/util/memory/in-memory-session-manager.js';
export type { SessionManager, ConversationSession } from '@senars/util/types/memory.js';