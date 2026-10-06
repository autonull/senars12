import { sortableIdSource } from '@senars/util';
import { PushQueue } from '@senars/util/events';
import { validateCognitiveEvent } from '../schemas/cognitive-events.js';
import type { CognitiveEvent, EventLog, EventLogQuery } from './EventLog.js';
import {
  EventLogError,
  type SubscriptionFilter,
  subscriptionAdmits,
  typeSetOf,
} from './EventLog.js';

export interface EventLogLimits {
  maxEvents: number;
  maxEventSize: number;
}

const DEFAULT_LIMITS: EventLogLimits = { maxEvents: 100_000, maxEventSize: 1024 * 1024 };

export abstract class AbstractEventLog implements EventLog {
  #subscribers = new Set<Subscription>();
  #closed = false;

  /** The one closed-log refusal. `append` and every `doAppend` reach it through here. */
  protected assertOpen(): void {
    if (this.#closed) throw new EventLogError('UNAVAILABLE', 'Event log is closed');
  }
  readonly #ids = sortableIdSource();
  protected readonly limits: EventLogLimits;

  constructor(limits: Partial<EventLogLimits> = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  /**
   * Shared append preconditions: closed log, oversized event, or full store.
   *
   * `payloadJson` is the serialization this append already performed, so the size
   * guard costs no second pass over the event and reports the number the durable
   * log stores. The envelope around a payload — a UUID id, a type name, two
   * integers — is bounded by construction and by `maxEvents`, so the payload is
   * what a size limit can actually be exceeded by.
   */
  protected assertAppendable(payloadJson: string, isFull: boolean): void {
    this.assertOpen();

    const eventSize = payloadJson.length;
    if (eventSize > this.limits.maxEventSize) {
      throw new EventLogError(
        'INVALID_EVENT',
        `Event size ${eventSize} exceeds max ${this.limits.maxEventSize}`
      );
    }

    if (isFull) {
      throw new EventLogError('FULL', `Event log full (${this.limits.maxEvents} events)`);
    }
  }

  protected markClosed(): void {
    this.#closed = true;
  }

  async close(): Promise<void> {
    this.markClosed();
    for (const sub of this.#subscribers) sub.queue.close();
    this.#subscribers.clear();
  }

  abstract get size(): number;

  abstract get events(): ReadonlyArray<CognitiveEvent>;

  /**
   * Append-order key. Monotonic and lexicographically sortable, because both
   * logs range-scan on it (`ORDER BY id`, `getRange`) — one source, shared by
   * both, so the sqlite and in-memory logs order identically.
   */
  generateId(): string {
    return this.#ids();
  }

  abstract getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]>;

  abstract query(query: EventLogQuery): Promise<CognitiveEvent[]>;

  async append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent> {
    this.assertOpen();
    const full = validateCognitiveEvent({
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
    });
    await this.doAppend(full, JSON.stringify(full.payload));
    this.notify(full);
    return full;
  }

  subscribe(options?: {
    filter?: (event: CognitiveEvent) => boolean;
    fromId?: string;
    types?: string[];
  }): AsyncIterable<CognitiveEvent> {
    const queue = new PushQueue<CognitiveEvent>();
    const subscription: Subscription = {
      filter: options?.filter,
      fromId: options?.fromId,
      types: typeSetOf(options?.types),
      queue,
    };
    queue.onClose = () => this.#subscribers.delete(subscription);

    this.#subscribers.add(subscription);

    if (options?.fromId) {
      this.getRange(options.fromId).then((events) => {
        for (const event of events) {
          if (subscriptionAdmits(subscription, event)) subscription.queue.push(event);
        }
      });
    }

    return subscription.queue;
  }

  abstract getSnapshot<T>(projectionName: string, version: number): Promise<T | null>;

  abstract saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void>;

  notify(event: CognitiveEvent): void {
    for (const sub of this.#subscribers) {
      if (sub.queue.closed) continue;
      try {
        if (sub.fromId && sub.fromId >= (event.id ?? '')) continue;
        if (!subscriptionAdmits(sub, event)) continue;
        sub.queue.push(event);
      } catch {
        // one subscriber must not stop the fan-out
      }
    }
  }

  protected abstract doAppend(event: CognitiveEvent, payloadJson: string): Promise<void>;
}

interface Subscription extends SubscriptionFilter {
  fromId?: string;
  queue: PushQueue<CognitiveEvent>;
}
