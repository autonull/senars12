export type { CognitiveStateSnapshot } from './EventLogPersistence.js';
export {
  loadGateEvents,
  persistGateLogs,
  replayCognitiveState,
  replayTaskAdmissions,
} from './EventLogPersistence.js';
export {
  createGateRegistry,
  GateRegistry,
  gateRegistry,
  resetGateRegistry,
} from './GateRegistry.js';
export { KernelActionGate, NALVetoError } from './KernelActionGate.js';
export { KernelBudgetGate } from './KernelBudgetGate.js';
export { KernelPerceptionGate } from './KernelPerceptionGate.js';
export {
  EpistemicFirewallViolation,
  ExternalRewardGate,
  KernelRewardGate,
  SelfRewardGate,
} from './KernelRewardGate.js';
export {
  type FullReplayOptions,
  loadDerivationRecords,
  persistDerivationRecords,
  type ReplayResult,
  replayIntoMemory,
  serializeReplayResult,
} from './replay.js';
