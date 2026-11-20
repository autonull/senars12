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
} from './events.js';
export { LogStoreEventLog, InMemoryEventLog } from './EventLogAdapter.js';
export { createLogStoreEventLog, createLogStoreEventLogFromStore } from './EventLogAdapter.js';
export { createLogStore } from './store.js';