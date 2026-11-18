/**
 * EventLog Adapter — implements the legacy EventLog interface using LogStore.
 *
 * This adapter bridges the legacy `EventLog` interface (used by SqliteEventLog,
 * InMemoryEventLog) to the new unified `LogStore`. It enables migration of
 * existing code without changing the interface.
 */

import { z } from 'zod';
import type { LogStore } from './store.js';
import type { LogEntry, CognitiveEvent as LogCognitiveEvent, UUID, TimestampMs } from './events.js';
import { createLogEntry, hashEntry } from './events.js';
import type { EventLog, EventLogConfig, EventLogQuery, CognitiveEvent as CoreCognitiveEvent } from '@senars/core/eventlog';
import { CognitiveEventSchema } from '@senars/core/schemas/cognitive-events';
import { PushQueue } from '@senars/util/events';

interface Subscription {
  filter?: (event: CoreCognitiveEvent) => boolean;
  fromId?: string;
  types?: ReadonlySet<string>;
  queue: PushQueue<CoreCognitiveEvent>;
}

/**
 * Adapter that implements the legacy EventLog interface using LogStore.
 */
export class LogStoreEventLog implements EventLog {
  private store: LogStore;
  private closed = false;
  private subscribers = new Set<Subscription>();
  private limits = { maxEvents: 100_000, maxEventSize: 1024 * 1024 };

  constructor(store: LogStore) {
    this.store = store;
  }

  get size(): number {
    return this.store.getEntryCount();
  }

  get events(): ReadonlyArray<CoreCognitiveEvent> {
    // This is expensive - materializes all events. Used by InMemoryEventLog compatibility.
    // Note: synchronous version for compatibility; prefer async iteration in new code.
    const entries: CoreCognitiveEvent[] = [];
    // We can't use await here, so this returns empty for now.
    // In practice, callers should use query() or getRange() instead.
    return entries;
  }

  async append(event: Omit<CoreCognitiveEvent, 'id' | 'timestamp'>): Promise<CoreCognitiveEvent> {
    if (this.closed) throw new Error('Event log is closed');

    const fullEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    } as CoreCognitiveEvent;

    // Validate the event using core schema
    const validated = CognitiveEventSchema.parse(fullEvent);

    // Convert to log store event format and append
    const logEvent = this.convertToLogEvent(validated);
    await this.store.append(logEvent, { ts: validated.timestamp });

    // Notify subscribers
    this.notify(validated);

    return validated;
  }

  private convertToLogEvent(event: CoreCognitiveEvent): LogCognitiveEvent {
    // The new LogCognitiveEvent type is compatible since we added 'kernel' to ENGINE_ORIGINS
    // and the base fields match. Cast through unknown to satisfy TypeScript.
    return event as unknown as LogCognitiveEvent;
  }

  subscribe(options?: {
    filter?: (event: CoreCognitiveEvent) => boolean;
    fromId?: string;
    types?: string[];
  }): AsyncIterable<CoreCognitiveEvent> {
    const queue = new PushQueue<CoreCognitiveEvent>();
    const typesSet = options?.types?.length ? new Set(options.types) : undefined;

    const subscription: Subscription = {
      filter: options?.filter,
      fromId: options?.fromId,
      types: typesSet,
      queue,
    };

    queue.onClose = () => this.subscribers.delete(subscription);
    this.subscribers.add(subscription);

    if (options?.fromId) {
      // Replay from fromId
      this.replayFromId(options.fromId, subscription).catch(() => {});
    }

    return queue;
  }

  private async replayFromId(fromId: string, subscription: Subscription): Promise<void> {
    for (let seq = this.store.getFirstSeq(); seq <= this.store.getLastSeq(); seq++) {
      const entry = await this.store.read(seq);
      if (!entry) continue;
      if (entry.id === fromId) {
        // Start from next event
        for (let s = seq + 1; s <= this.store.getLastSeq(); s++) {
          const e = await this.store.read(s);
          if (!e) continue;
          const coreEvent = this.convertFromLogEvent(e.event);
          if (this.matchesSubscription(subscription, coreEvent)) {
            subscription.queue.push(coreEvent);
          }
        }
        break;
      }
    }
  }

  private convertFromLogEvent(event: LogCognitiveEvent): CoreCognitiveEvent {
    // The LogCognitiveEvent has the same base structure as CoreCognitiveEvent
    // since we aligned ENGINE_ORIGINS. Cast through unknown.
    return event as unknown as CoreCognitiveEvent;
  }

  private matchesSubscription(subscription: Subscription, event: CoreCognitiveEvent): boolean {
    if (subscription.types && !subscription.types.has(event.type)) return false;
    if (subscription.filter && !subscription.filter(event)) return false;
    return true;
  }

  notify(event: CoreCognitiveEvent): void {
    for (const sub of this.subscribers) {
      if (sub.queue.closed) continue;
      if (sub.fromId && sub.fromId >= (event.id ?? '')) continue;
      if (!this.matchesSubscription(sub, event)) continue;
      try {
        sub.queue.push(event);
      } catch {
        // One subscriber must not stop the fan-out
      }
    }
  }

  async query(query: EventLogQuery): Promise<CoreCognitiveEvent[]> {
    const results: CoreCognitiveEvent[] = [];
    const typesSet = query.types?.length ? new Set(query.types) : undefined;
    const limit = query.limit ?? Number.MAX_SAFE_INTEGER;
    let count = 0;

    // Read from newest to oldest for limit efficiency
    for (let seq = this.store.getLastSeq(); seq >= this.store.getFirstSeq() && count < limit; seq--) {
      const entry = await this.store.read(seq);
      if (!entry) continue;

      const event = this.convertFromLogEvent(entry.event);

      if (query.correlationId && event.correlationId !== query.correlationId) continue;
      if (typesSet && !typesSet.has(event.type)) continue;
      if (query.timeRange && (event.timestamp < query.timeRange[0] || event.timestamp > query.timeRange[1])) continue;

      results.push(event);
      count++;
    }

    return results.reverse(); // Return in chronological order
  }

  async getRange(fromId: string, toId?: string): Promise<CoreCognitiveEvent[]> {
    const results: CoreCognitiveEvent[] = [];
    let started = false;

    for (let seq = this.store.getFirstSeq(); seq <= this.store.getLastSeq(); seq++) {
      const entry = await this.store.read(seq);
      if (!entry) continue;

      const event = this.convertFromLogEvent(entry.event);

      if (!started) {
        if (event.id === fromId || (event.id ?? '') > fromId) {
          started = true;
        } else {
          continue;
        }
      }

      if (toId && (event.id ?? '') > toId) break;

      results.push(event);
    }

    return results;
  }

  async getSnapshot<T>(projectionName: string, version: number): Promise<T | null> {
    // Snapshots are not directly supported by LogStore yet
    // Could be implemented using a separate snapshot store
    return null;
  }

  async saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void> {
    // Snapshots are not directly supported by LogStore yet
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    for (const sub of this.subscribers) {
      sub.queue.close();
    }
    this.subscribers.clear();

    await this.store.close();
  }
}

/**
 * Create a LogStoreEventLog with default configuration.
 */
export async function createLogStoreEventLog(config?: { dir?: string }): Promise<LogStoreEventLog> {
  const { createLogStore } = await import('./store.js');
  const store = createLogStore(config ? { dir: config.dir } : undefined);
  await store.open();
  return new LogStoreEventLog(store);
}

/**
 * Create a LogStoreEventLog from an existing LogStore.
 */
export function createLogStoreEventLogFromStore(store: LogStore): LogStoreEventLog {
  return new LogStoreEventLog(store);
}