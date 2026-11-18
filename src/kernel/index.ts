/**
 * Kernel — barrel export.
 */

export * from './terms/index.js';
export * from './types.js';
export { createRootStamp, createDerivedStamp, createStampFromIds, mergeStamps, isBefore, isAncestor, getCausalChain, getAncestors, getCommonAncestors, stampEquals, stampCompare, formatStamp, StampStore, createStampStore, reconstructStampsFromLog } from './stamp.js';
export type { Stamp, StampOptions, TimestampMs, LogEntryWithStamp } from './stamp.js';
export * from './truth.js';
export * from './step.js';
export * from './gate.js';
export * from './reduce.js';
export * from './bag.js';