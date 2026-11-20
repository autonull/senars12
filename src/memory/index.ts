// Bag/BoundedBag removed — use PriorityBag from @senars/nar/bag instead (unified AIKR substrate).
//
// This barrel is an aggregator, not a second declaration: every sub-barrel below
// owns its own surface and this file only forwards it, so a symbol can be
// published, changed or withdrawn in one place.
export type { CoActivationEdge, ConceptGraphOptions } from './ConceptGraph.js';
export { ConceptGraph } from './ConceptGraph.js';
export type { ConceptTaskType } from './concept.js';
export { Concept, taskFromBagItem } from './concept.js';
export type { MemoryConfig, ResolvedMemoryConfig } from './config.js';
export { Focus } from './focus.js';
export type { ArchiveConfig, ForgettingPolicy } from './lifecycle/index.js';
export { Archive, Forgetting } from './lifecycle/index.js';
export { Memory } from './memory.js';
export { MemoryIndex } from './memory-index.js';
export type * from './ports/index.js';
export { evictUnderPressure } from './pressure/index.js';
export { MemoryService } from './MemoryService.js';
export { EpisodicMemory } from './episodic.js';
export type { PersistableSessionManager } from './types.js';
export { abortSession, createSession, InMemorySessionManager, JsonlSessionManager, type JsonlSessionManagerConfig } from './SessionManager.js';
export { SessionStore, type SessionStoreOptions } from './in-memory-session-manager.js';
export type { Episode, EpisodeFilter, EpisodeType, EpisodicMemoryConfig } from './episodic.js';
export { EPISODE_TYPES } from './episodic.js';
export { MockEmbeddingGenerator, type EmbeddingGenerator } from './embedding.js';
export { consolidateEpisodes } from './retrieval-verified.js';
export type { ConceptStats, SerializedConcept, SerializedMemory } from './state/index.js';
export {
  calculateConceptStats,
  decodeMemoryState,
  deserialize,
  encodeMemoryState,
  repair,
  serialize,
  validate,
} from './state/index.js';
