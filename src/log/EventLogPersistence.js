/**
 * EventLogPersistence — pure replay reducers for cognitive state.
 *
 * Provides pure reducer functions for reconstructing cognitive state from event logs.
 * Persistence is now handled by LogStoreGateEventLedger in @senars/log/GateEventLedger.
 */
export { replayTaskAdmissions, SNAPSHOT_VERSION, replayCognitiveState, } from './replay-reducers';
