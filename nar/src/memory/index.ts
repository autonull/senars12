// Core memory structures

// Bag/BoundedBag removed - use PriorityBag from @senars/nar/bag instead (unified AIKR substrate)
export type {ConceptTaskType} from './concept.js';
export {Concept} from './concept.js';
export {Focus} from './focus.js';
// Lifecycle module
export type {ArchiveConfig} from './lifecycle/archive.js';
export {Archive} from './lifecycle/archive.js';
export type {
    ForgettingConfig,
    ForgettingHooks,
    ForgettingPolicy,
} from './lifecycle/forgetting.js';
export {Forgetting} from './lifecycle/forgetting.js';
export type {TermMeta} from './lifecycle/gc.js';
export {
    getTermMeta,
    structuralGC,
    trackTerm,
    untrackTerm,
    updateAccessTime,
} from './lifecycle/gc.js';
export type {MemoryConfig, MemoryStatistics} from './memory.js';
export {Memory} from './memory.js';
// Memory modules - internal to Memory class now
export {MemoryIndex} from './memory-index.js';
export type {ConsolidationConfig} from './pressure/consolidation.js';
export {MemoryConsolidation} from './pressure/consolidation.js';
export type {PressureConfig} from './pressure/pressure.js';
// Pressure module
export {PressureDetector} from './pressure/pressure.js';
export type {ScorerConfig} from './pressure/scorer.js';
export {MemoryScorer} from './pressure/scorer.js';
export type {
    SerializedConcept,
    SerializedMemory,
    SerializedTask,
} from './state/serialization.js';
// State module
export {deserialize, repair, serialize, validate} from './state/serialization.js';
export type {ConceptStats} from './state/statistics.js';
export {calculateConceptStats} from './state/statistics.js';
