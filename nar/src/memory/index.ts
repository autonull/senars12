// Bag/BoundedBag removed — use PriorityBag from @senars/nar/bag instead (unified AIKR substrate).
//
// This barrel is an aggregator, not a second declaration: every sub-barrel below
// owns its own surface and this file only forwards it, so a symbol can be
// published, changed or withdrawn in one place.
export type { CoActivationEdge, ConceptGraphOptions } from './ConceptGraph.js';
export { ConceptGraph } from './ConceptGraph.js';
export type { ConceptTaskType } from './concept.js';
export { Concept } from './concept.js';
export { Focus } from './focus.js';
export type { ArchiveConfig, ForgettingPolicy } from './lifecycle/index.js';
export { Archive, Forgetting } from './lifecycle/index.js';
export type { MemoryConfig, ResolvedMemoryConfig } from './config.js';
export { Memory } from './memory.js';
export { MemoryIndex } from './memory-index.js';
export type * from './ports/index.js';
export type { ScorerConfig } from './pressure/index.js';
export { evictUnderPressure, MemoryScorer } from './pressure/index.js';
export type {
  ConceptStats,
  SerializedConcept,
  SerializedMemory,
  SerializedTask,
} from './state/index.js';
export {
  calculateConceptStats,
  decodeMemoryState,
  deserialize,
  encodeMemoryState,
  repair,
  serialize,
  validate,
} from './state/index.js';
