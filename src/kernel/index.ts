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
export {
  BUDGET_SCOPE_IDS,
  BUDGET_SCOPES,
  type BudgetDimension,
  type BudgetScopeId,
  type BudgetScopeSpec,
  scopeBudget,
  scopeLimit,
  scopeSpec,
  type ControlBudgetOverrides,
  type ControlBudgetPort,
  UNBUDGETED,
  ControlBudgets,
  type AutonomyClock,
  driveCycles,
  type GateRegistryInit,
  type IGateRegistry,
  createGateRegistry,
  GateRegistry,
  KernelGate,
  type IActionGate,
  type IBudgetGate,
  type IDriveManager,
  type IPerceptionGate,
  type IRewardGate,
  KernelActionGate,
  NALVetoError,
  createDefaultReasoningBudget,
  KernelBudgetGate,
  KernelLedger,
  KernelPerceptionGate,
  EpistemicFirewallViolation,
  ExternalRewardGate,
  KernelRewardGate,
  SelfRewardGate,
  domainKey,
  providerKey,
  DEFAULT_REPUTATION_CAPACITY,
  DEFAULT_REPUTATION_PATH,
  type ReputationDeltaEntry,
  type ReputationEntry,
  SourceReputation,
  type SourceReputationOptions,
  type ThreadScopeState,
  ThreadScope,
  threadScope,
} from '@senars/nar/kernel';

// Re-export NAR engine
export { NAREngine } from '@senars/nar/engine';
export { BaseEngine } from '@senars/core';

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
} from '@senars/nar/kernel/replay-compat.js';