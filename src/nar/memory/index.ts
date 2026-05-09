// Core memory structures
export {Concept} from './concept.js';
export type {ConceptTaskType} from './concept.js';

export {Bag} from './bag.js';
export {BoundedBag} from './bounded-bag.js';
export {AbstractBag} from './bag-base.js';
export type {BagItem} from './bag-base.js';

export {Memory} from './memory.js';
export type {MemoryConfig, MemoryStatistics} from './memory.js';

// Memory modules - internal to Memory class now
export {MemoryIndex} from './memory-index.js';
export {Focus} from './focus.js';
export {MemoryScorer} from './scorer.js';
export {Archive} from './archive.js';

// Memory utilities
export type {TermMeta} from './gc.js';
export {trackTerm, untrackTerm, updateAccessTime, getTermMeta, structuralGC} from './gc.js';

export type {ForgettingPolicy} from './forgetting.js';
export {Forgetting} from './forgetting.js';
