// Core memory structures
export { Concept } from './concept.js';
export type { ConceptTaskType } from './concept.js';

export { Bag, Bag as BoundedBag } from './bag.js';
export type { BagItem } from './bag.js';

export { Memory } from './memory.js';
export type { MemoryConfig, MemoryStatistics } from './memory.js';

// Memory modules - internal to Memory class now
export { MemoryIndex } from './memory-index.js';
export { Focus } from './focus.js';

// Lifecycle module
export type { ArchiveConfig } from './lifecycle/archive.js';
export { Archive } from './lifecycle/archive.js';
export type { TermMeta } from './lifecycle/gc.js';
export {
  trackTerm,
  untrackTerm,
  updateAccessTime,
  getTermMeta,
  structuralGC,
} from './lifecycle/gc.js';
export type {
  ForgettingPolicy,
  ForgettingConfig,
  ForgettingHooks,
} from './lifecycle/forgetting.js';
export { Forgetting } from './lifecycle/forgetting.js';

// Pressure module
export { PressureDetector } from './pressure/pressure.js';
export type { PressureConfig } from './pressure/pressure.js';
export { MemoryScorer } from './pressure/scorer.js';
export type { ScorerConfig } from './pressure/scorer.js';
export { MemoryConsolidation } from './pressure/consolidation.js';
export type { ConsolidationConfig } from './pressure/consolidation.js';

// State module
export { serialize, deserialize, validate, repair } from './state/serialization.js';
export type {
  SerializedMemory,
  SerializedConcept,
  SerializedTask,
  BagItemWithMeta,
} from './state/serialization.js';
export { calculateConceptStats } from './state/statistics.js';
export type { ConceptStats } from './state/statistics.js';
