/**
 * LogStore-based GateEventLedger — runtime durability for kernel gate decisions.
 *
 * Replaces file-based GateEventLedger with LogStore-backed persistence.
 * Uses the unified event log for all gate events.
 * Gate events are identified by engine='kernel' and specific event types.
 */
import type { LogStore } from './store';
import type { CognitiveEvent } from './events';
import { createLogger } from '@senars/util/logger';
/** Gate log keys — must match nar/src/kernel/event-ring.ts */
declare const GATE_LOG_KEYS: readonly ['perception', 'action', 'autonomy', 'reward', 'budget'];
type GateLogKey = (typeof GATE_LOG_KEYS)[number];
/** One persisted gate event and the ring it came from. */
interface GateLogEntry {
    gate: GateLogKey;
    event: CognitiveEvent;
}
/** Minimal GateRegistry interface needed by GateEventLedger. */
interface GateRegistry {
    getAllEventLogs(): {
        perception: ReadonlyArray<CognitiveEvent>;
        action: ReadonlyArray<CognitiveEvent>;
        autonomy: ReadonlyArray<CognitiveEvent>;
        reward: ReadonlyArray<CognitiveEvent>;
        budget: ReadonlyArray<CognitiveEvent>;
    };
    restoreEventLogs(entries: ReadonlyArray<GateLogEntry>): number;
}
export interface GateEventLedgerOptions {
    /** Where a replay reports what it resumed. */
    logger?: ReturnType<typeof createLogger>;
}
/**
 * LogStore-backed gate event ledger.
 * Gate events are stored as CognitiveEvents with engine='kernel' in the unified log.
 */
export declare class LogStoreGateEventLedger {
    #private;
    constructor(store: LogStore, options?: GateEventLedgerOptions);
    /** Append every not-yet-written gate event; returns how many were written. */
    flush(registry: GateRegistry): Promise<number>;
    /** Get the current cursor position (for compatibility). */
    getCursor(): number;
    /** Advance the cursor to the current log head (no-op, kept for compatibility). */
    advanceCursor(): void;
    /** Read gate events from the log, oldest first. */
    read(limit?: number): Promise<CognitiveEvent[]>;
    /** Read gate events with their originating gate ring. */
    readWithGate(limit?: number): Promise<Array<{
        gate: (typeof GATE_LOG_KEYS)[number];
        event: CognitiveEvent;
    }>>;
    /** Mark events read back from disk as already-replayed. */
    adopt(entries: ReadonlyArray<{
        event: CognitiveEvent;
    }>): void;
    /**
     * Replay persisted gate events into the registry's rings.
     * Re-seeds them with what a prior run decided.
     */
    replayInto(registry: GateRegistry): Promise<number>;
    close(): void;
}
/** Create a LogStoreGateEventLedger. */
export declare const createLogStoreGateEventLedger: (store: LogStore, options?: GateEventLedgerOptions) => LogStoreGateEventLedger;
export {};
//# sourceMappingURL=GateEventLedger.d.ts.map