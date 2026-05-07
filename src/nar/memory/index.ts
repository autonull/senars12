// Core memory structures
export {Concept} from './concept.js';
export type {ConceptTaskType} from './concept.js';

export {Bag} from './bag.js';
export {BoundedBag} from './bounded-bag.js';

export {Memory} from './memory.js';
export type {MemoryConfig} from './memory.js';

// Memory modules
export {MemoryIndex, memoryIndex} from './memory-index.js';
export {Focus, focus} from './focus.js';
export {MemoryScorer, memoryScorer} from './scorer.js';
export {MemoryConsolidation, memoryConsolidation} from './consolidation.js';
export {Archive, archive} from './archive.js';
export {MemoryStatistics, memoryStatistics} from './statistics.js';

// Memory utilities
export type {TermMeta} from './gc.js';
export {trackTerm, untrackTerm, updateAccessTime, getTermMeta, structuralGC} from './gc.js';

export type {ForgettingPolicy} from './forgetting.js';
export {Forgetting} from './forgetting.js';
