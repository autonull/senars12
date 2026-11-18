/**
 * Kernel — interned terms, truth, stamps, step, gate, bag, reduce.
 * Also re-exports NAR kernel types (migrated from @senars/nar/kernel).
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

// Re-export NAR kernel types
export { DEFAULT_REPUTATION_PATH, providerKey, SourceReputation, threadScope } from '@senars/nar/kernel';
export { createGateRegistry, GateRegistry, type GateRegistryInit, type IGateRegistry } from '@senars/nar/kernel';

// Re-export NAR engine
export { NAREngine } from '@senars/nar/engine';

// Re-export replay utilities
export {
  type FullReplayOptions,
  type ReplayResult,
  type ReplayTally,
  type ReplaySnapshotFile,
  type CognitiveStateSnapshot,
  replayIntoMemory,
  computeReplayStateHash,
  verifyReplayStateHash,
  serializeReplayResult,
  persistDerivationRecords,
  loadGateEvents,
  replayTaskAdmissions,
  replayCognitiveState,
  SNAPSHOT_VERSION,
} from '../../nar/src/kernel/replay-compat.js';