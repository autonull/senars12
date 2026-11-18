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
} from '@senars/log';
export { LogStoreEventLog } from '@senars/log/EventLogAdapter.js';
export { createLogStoreEventLog, createLogStoreEventLogFromStore } from '@senars/log/EventLogAdapter.js';