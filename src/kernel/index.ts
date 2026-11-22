export {
  BUDGET_SCOPE_IDS,
  BUDGET_SCOPES,
  type BudgetDimension,
  type BudgetScopeId,
  type BudgetScopeSpec,
  scopeBudget,
  scopeLimit,
  scopeLimitKey,
  scopeSpec,
  scopeTerminationReason,
  DECISION_DERIVATIONS_SCOPE,
} from './budget-scopes';
export {
  type ControlBudgetOverrides,
  type ControlBudgetPort,
  UNBUDGETED,
  ControlBudgets,
} from './control-budgets';
export type { AutonomyClock } from './cycle-driver';
export { driveCycles } from './cycle-driver';
export type { GateRegistryInit, IGateRegistry } from './GateRegistry';
export { createGateRegistry, GateRegistry } from './GateRegistry';
export { KernelGate } from './gate-base';
export type {
  IActionGate,
  IBudgetGate,
  IDriveManager,
  IPerceptionGate,
  IRewardGate,
} from './interfaces';
export { KernelActionGate, NALVetoError } from './KernelActionGate';
export { createDefaultReasoningBudget, KernelBudgetGate } from './KernelBudgetGate';
export { KernelLedger } from './KernelLedger';
export { KernelPerceptionGate } from './KernelPerceptionGate';
export {
  EpistemicFirewallViolation,
  ExternalRewardGate,
  KernelRewardGate,
  SelfRewardGate,
} from './KernelRewardGate';
export { domainKey, providerKey } from './reputation-keys';
export {
  DEFAULT_REPUTATION_CAPACITY,
  DEFAULT_REPUTATION_PATH,
  type ReputationDeltaEntry,
  type ReputationEntry,
  SourceReputation,
  type SourceReputationOptions,
} from './source-reputation';
export type { ThreadScopeState } from './thread-scope';
export { ThreadScope, threadScope } from './thread-scope';

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
} from './replay-compat';
export { SNAPSHOT_VERSION, type CognitiveStateSnapshot as KernelCognitiveStateSnapshot } from '../log/replay-reducers';

export {
  type TruthValue,
  Truth,
  normalize,
  createTruth,
  verifyTruthLaws,
} from './truth';
export type { TruthLike } from './types';
export {
  type TruthValueSchema,
  toSchemaTruth,
  fromSchemaTruth,
  parseTruthLiteral,
  formatTruth,
  formatSchemaTruth,
  serializeTruth,
} from './types';

export {
  conceptValue,
  evictionOrder,
  evictUnderPressure,
  type EvictionReason,
  type EvictionReport,
} from '../memory/pressure/index';
export { PriorityBag } from '../bag/index';
