/**
 * EventLog Adapter — implements the legacy EventLog interface using LogStore.
 *
 * This adapter bridges the legacy `EventLog` interface (used by SqliteEventLog,
 * InMemoryEventLog) to the new unified `LogStore`. It enables migration of
 * existing code without changing the interface.
 */
import type { LogStore } from './store';
import type { CognitiveEvent, EventLog, EventLogQuery } from './events';
/**
 * Adapter that implements the legacy EventLog interface using LogStore.
 */
export declare class LogStoreEventLog implements EventLog {
    private store;
    private closed;
    private subscribers;
    private limits;
    constructor(store: LogStore);
    get size(): number;
    get events(): ReadonlyArray<CognitiveEvent>;
    append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent>;
    private convertToLogEvent;
    subscribe(options?: {
        filter?: (event: CognitiveEvent) => boolean;
        fromId?: string;
        types?: string[];
    }): AsyncIterable<CognitiveEvent>;
    private replayFromId;
    private convertFromLogEvent;
    private matchesSubscription;
    notify(event: CognitiveEvent): void;
    query(query: EventLogQuery): Promise<CognitiveEvent[]>;
    getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]>;
    getSnapshot<T>(projectionName: string, version: number): Promise<T | null>;
    saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void>;
    close(): Promise<void>;
}
/**
 * Create a LogStoreEventLog with default configuration.
 */
export declare function createLogStoreEventLog(config?: {
    dir?: string;
}): Promise<LogStoreEventLog>;
/**
 * Create a LogStoreEventLog from an existing LogStore.
 */
export declare function createLogStoreEventLogFromStore(store: LogStore): LogStoreEventLog;
/**
 * InMemoryEventLog — legacy-compatible in-memory event log.
 *
 * This is a compatibility wrapper for tests that still use the old InMemoryEventLog interface.
 * New code should use LogStoreEventLog directly with createLogStoreEventLog().
 */
export declare class InMemoryEventLog extends LogStoreEventLog {
    constructor();
}
//# sourceMappingURL=EventLogAdapter.d.ts.map