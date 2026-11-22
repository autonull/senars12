/**
 * EventLog — unified adapter over LogStore.
 *
 * The legacy SqliteEventLog and InMemoryEventLog have been replaced by
 * LogStoreEventLog from @senars/log. This module re-exports the adapter
 * for compatibility.
 */

export type {
  EventLog,
  EventLogConfig,
  EventLogQuery,
  CognitiveEvent,
} from './events';
export { LogStoreEventLog, InMemoryEventLog } from './EventLogAdapter';
export { createLogStoreEventLog, createLogStoreEventLogFromStore } from './EventLogAdapter';
export { createLogStore } from './store';
export { replayTaskAdmissions } from './EventLogPersistence';