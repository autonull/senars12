export type { ArchiveConfig } from './archive.js';
export { Archive } from './archive.js';
export type { ForgettingConfig, ForgettingHooks, ForgettingPolicy } from './forgetting.js';
export { Forgetting } from './forgetting.js';
export type { TermMeta } from './gc.js';
export { getTermMeta, structuralGC, trackTerm, untrackTerm, updateAccessTime } from './gc.js';
