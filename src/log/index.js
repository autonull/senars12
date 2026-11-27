/**
 * EventLog — unified adapter over LogStore.
 *
 * The legacy SqliteEventLog and InMemoryEventLog have been replaced by
 * LogStoreEventLog from @senars/log. This module re-exports the adapter
 * for compatibility.
 */
export { LogStoreEventLog, InMemoryEventLog } from './EventLogAdapter';
export { createLogStoreEventLog, createLogStoreEventLogFromStore } from './EventLogAdapter';
export { createLogStore, createInMemoryLogStore, InMemoryLogStore } from './store';
export { replayTaskAdmissions } from './EventLogPersistence';
