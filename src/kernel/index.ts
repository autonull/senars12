export {
  BUDGET_SCOPE_IDS,
  BUDGET_SCOPES,
  type BudgetDimension,
  type BudgetScopeId,
  type BudgetScopeSpec,
  scopeBudget,
  scopeLimit,
  scopeSpec,
} from './budget-scopes.js';
export {
  type ControlBudgetOverrides,
  type ControlBudgetPort,
  UNBUDGETED,
  ControlBudgets,
} from './control-budgets.js';
export type { AutonomyClock } from './cycle-driver.js';
export { driveCycles } from './cycle-driver.js';
export type { GateRegistryInit, IGateRegistry } from './GateRegistry.js';
export { createGateRegistry, GateRegistry } from './GateRegistry.js';
export { KernelGate } from './gate-base.js';
export type {
  IActionGate,
  IBudgetGate,
  IDriveManager,
  IPerceptionGate,
  IRewardGate,
} from './interfaces.js';
export { KernelActionGate, NALVetoError } from './KernelActionGate.js';
export { createDefaultReasoningBudget, KernelBudgetGate } from './KernelBudgetGate.js';
export { KernelLedger } from './KernelLedger.js';
export { KernelPerceptionGate } from './KernelPerceptionGate.js';
export {
  EpistemicFirewallViolation,
  ExternalRewardGate,
  KernelRewardGate,
  SelfRewardGate,
} from './KernelRewardGate.js';
export { domainKey, providerKey } from './reputation-keys.js';
export {
  DEFAULT_REPUTATION_CAPACITY,
  DEFAULT_REPUTATION_PATH,
  type ReputationDeltaEntry,
  type ReputationEntry,
  SourceReputation,
  type SourceReputationOptions,
} from './source-reputation.js';
export type { ThreadScopeState } from './thread-scope.js';
export { ThreadScope, threadScope } from './thread-scope.js';

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
} from './replay-compat.js';

export {
  type Truth,
  type TruthValue,
  type TruthLike,
  Truth,
  normalize,
  createTruth,
  verifyTruthLaws,
} from './truth.js';
export {
  type TruthValueSchema,
  toSchemaTruth,
  fromSchemaTruth,
  parseTruthLiteral,
  formatTruth,
  formatSchemaTruth,
  serializeTruth,
} from './types.js';
