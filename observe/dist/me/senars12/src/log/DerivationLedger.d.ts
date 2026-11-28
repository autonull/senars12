/**
 * LogStore-based DerivationLedger — runtime durability for derivation fire ring.
 *
 * Replaces file-based DerivationLedger with LogStore-backed persistence.
 * Uses the unified event log for all derivation events.
 */
import type { LogStore } from './store';
import type { CognitiveEvent } from './events';
import type { DerivationRecorder } from '../rules/impls/recorder';
import { createLogger } from '../util/index';
export interface DerivationLedgerOptions {
    /** Where a replay reports what it resumed. */
    logger?: ReturnType<typeof createLogger>;
}
/**
 * LogStore-backed derivation ledger.
 * Derivation events are stored as CognitiveEvents with engine='nar' in the unified log.
 */
export declare class LogStoreDerivationLedger {
    #private;
    constructor(store: LogStore, options?: DerivationLedgerOptions);
    /** Get the current cursor position. */
    getCursor(): number;
    /** Advance the cursor to the current log head. */
    advanceCursor(): void;
    /**
     * Persist each completed chain as it closes (CORE.19 C3.4).
     * Push, not pull: the completed ring is drain-emptied by consumers.
     */
    observe(_recorder: DerivationRecorder): void;
    /** Append every not-yet-written rule fire; returns how many were written. */
    flush(recorder: DerivationRecorder): Promise<number>;
    /** Append every not-yet-written completed derivation record; returns how many were written. */
    flushRecords(recorder: DerivationRecorder): Promise<number>;
    /** Read derivation fires from the log, oldest first (incremental from cursor). */
    read(limit?: number): Promise<CognitiveEvent[]>;
    /** Read ALL derivation fires from the log, oldest first (for replay/test). */
    readAllFires(limit?: number): Promise<CognitiveEvent[]>;
    /** Read completed derivation records from the log. */
    readRecords(limit?: number): Promise<CognitiveEvent[]>;
    /** Mark fires read back from disk as already-written. */
    adopt(entries: ReadonlyArray<CognitiveEvent>): void;
    /**
     * Replay the persisted log into the recorder's fire ring (CORE.19 C4.3).
     * Reads ALL fires from the log (not cursor-based) for full replay on restart.
     */
    replayInto(recorder: DerivationRecorder): Promise<number>;
    /**
     * Re-seed the completed ring from the persisted chains (CORE.19 C3.4).
     */
    replayRecordsInto(recorder: DerivationRecorder): Promise<number>;
    close(): void;
}
/** Create a LogStoreDerivationLedger. */
export declare const createLogStoreDerivationLedger: (store: LogStore, options?: DerivationLedgerOptions) => LogStoreDerivationLedger;
//# sourceMappingURL=DerivationLedger.d.ts.map