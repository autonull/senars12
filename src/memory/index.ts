// Bag/BoundedBag removed — use PriorityBag from @senars/nar/bag instead (unified AIKR substrate).
//
// This barrel is an aggregator, not a second declaration: every sub-barrel below
// owns its own surface and this file only forwards it, so a symbol can be
// published, changed or withdrawn in one place.
export type { CoActivationEdge, ConceptGraphOptions } from './ConceptGraph';
export { ConceptGraph } from './ConceptGraph';
export type { ConceptTaskType } from './concept';
export { Concept, taskFromBagItem } from './concept';
export type { MemoryConfig, ResolvedMemoryConfig } from './config';
export { Focus } from './focus';
export type { ArchiveConfig, ForgettingPolicy } from './lifecycle/index';
export { Archive, Forgetting } from './lifecycle/index';
export { Memory } from './memory';
export { FoldMemory, createFoldMemory } from './fold-memory';
export { MemoryIndex } from './memory-index';
export type * from './ports/index';
export {
  evictUnderPressure,
  conceptValue,
  evictionOrder,
  type EvictionReason,
  type EvictionReport,
} from './pressure/index';
export { MemoryService } from './MemoryService';
export { EpisodicMemory } from './episodic';
export type { PersistableSessionManager } from './types';
export { abortSession, createSession, InMemorySessionManager, JsonlSessionManager, type JsonlSessionManagerConfig } from './SessionManager';
export { SessionStore, type SessionStoreOptions } from './in-memory-session-manager';
export type { Episode, EpisodeFilter, EpisodeType, EpisodicMemoryConfig } from './episodic';
export { EPISODE_TYPES, EpisodeSchema } from './episodic';
export { MockEmbeddingGenerator, type EmbeddingGenerator, createEmbeddingGenerator, isMockLM } from './embedding';
export { LINK_LAYER, type KnownLinkLayer } from './links/types';
export { Layer } from './links/Layer';
export { AssociativeRegistry, LinkLayerMemory, type AssociativeMemory } from './associative';
export { EpisodeConsolidator, symbolicSummary, episodeSalience, causalConnections } from './episode-consolidator';
export { consolidateEpisodes } from './retrieval-verified';
export * from './fold-views';
export type { ConceptStats, SerializedConcept, SerializedMemory } from './state/index';
export {
  calculateConceptStats,
  decodeMemoryState,
  deserialize,
  encodeMemoryState,
  repair,
  serialize,
  validate,
} from './state/index';
