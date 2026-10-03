import { getOrInsert, sortableIdSource } from '@senars/util';
import { PushQueue } from '@senars/util/events';
import { validateCognitiveEvent } from '../schemas/cognitive-events.js';
import type { CognitiveEvent, EventLog } from './EventLog.js';
import { EventLogError } from './EventLog.js';

export interface EventLogLimits {
  maxEvents: number;
  maxEventSize: number;
}

const DEFAULT_LIMITS: EventLogLimits = { maxEvents: 100_000, maxEventSize: 1024 * 1024 };

export abstract class AbstractEventLog implements EventLog {
  #subscribers = new Set<Subscription>();
  #snapshots = new Map<string, Map<number, unknown>>();
  #closed = false;
  readonly #ids = sortableIdSource();
  protected readonly limits: EventLogLimits;

  constructor(limits: Partial<EventLogLimits> = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  /** Shared append preconditions: closed log, oversized event, or full store. */
  protected assertAppendable(fullEvent: CognitiveEvent, isFull: boolean): void {
    if (this.#closed) {
      throw new EventLogError('UNAVAILABLE', 'Event log is closed');
    }

    const eventSize = JSON.stringify(fullEvent).length;
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

  async append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent> {
    if (this.#closed) {
      throw new Error('Event log is closed');
    }
    const full = validateCognitiveEvent({
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
    });
    await this.doAppend(full);
    this.notify(full);
    return full;
  }

  subscribe(options?: {
    filter?: (event: CognitiveEvent) => boolean;
    fromId?: string;
    types?: string[];
  }): AsyncIterable<CognitiveEvent> {
    const typesSet = options?.types ? new Set(options.types) : undefined;

    const subscription: Subscription = {
      filter: options?.filter,
      fromId: options?.fromId,
      types: typesSet,
      queue: new PushQueue<CognitiveEvent>(),
    };

    this.#subscribers.add(subscription);

    if (options?.fromId) {
      this.getRange(options.fromId).then((events) => {
        for (const event of events) {
          if (typesSet && !typesSet.has(event.type)) continue;
          if (options.filter && !options.filter(event)) continue;
          subscription.queue.push(event);
        }
      });
    }

    return {
      [Symbol.asyncIterator]: () => ({
        next: () => subscription.queue.next(),
        return: async () => {
          subscription.queue.close();
          return { value: undefined, done: true };
        },
      }),
    };
  }

  getSnapshot<T>(projectionName: string, version: number): Promise<T | null> {
    return Promise.resolve((this.#snapshots.get(projectionName)?.get(version) as T) ?? null);
  }

  saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void> {
    getOrInsert(this.#snapshots, projectionName, () => new Map()).set(version, data);
    return Promise.resolve();
  }

  notify(event: CognitiveEvent): void {
    for (const sub of this.#subscribers) {
      if (sub.queue.closed) continue;
      try {
        if (sub.fromId && sub.fromId >= (event.id ?? '')) continue;
        if (sub.types && !sub.types.has(event.type)) continue;
        if (sub.filter && !sub.filter(event)) continue;
        sub.queue.push(event);
      } catch {
        // ignore handler errors
      }
    }
  }

  protected abstract doAppend(event: CognitiveEvent): Promise<void>;
}

interface Subscription {
  filter?: (event: CognitiveEvent) => boolean;
  fromId?: string;
  types?: Set<string>;
  queue: PushQueue<CognitiveEvent>;
}
