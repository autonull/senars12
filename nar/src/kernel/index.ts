export { KernelPerceptionGate } from './KernelPerceptionGate.js';
export { KernelActionGate, NALVetoError } from './KernelActionGate.js';
export { KernelRewardGate, ExternalRewardGate, SelfRewardGate, EpistemicFirewallViolation } from './KernelRewardGate.js';
export { KernelBudgetGate } from './KernelBudgetGate.js';
export { GateRegistry, gateRegistry } from './GateRegistry.js';
export { persistGateLogs, loadGateEvents, replayTaskAdmissions, replayCognitiveState } from './EventLogPersistence.js';
export type { CognitiveStateSnapshot } from './EventLogPersistence.js';
export { replayIntoMemory, persistDerivationRecords, loadDerivationRecords, serializeReplayResult, type ReplayResult, type FullReplayOptions } from './replay.js';