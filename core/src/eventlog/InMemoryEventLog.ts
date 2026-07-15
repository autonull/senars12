import { ulid } from 'ulid';
import type { EventLog, EventLogConfig, CognitiveEvent } from './EventLog.js';
import { EventLogError } from './EventLog.js';
import { validatePayload } from '../events/EventTypes.js';

interface Subscription {
  filter?: (e: CognitiveEvent) => boolean;
  fromId?: string;
  types?: Set<string>;
  queue: CognitiveEvent[];
  resolver: ((value: IteratorResult<CognitiveEvent>) => void) | null;
}

export class InMemoryEventLog implements EventLog {
  #events: CognitiveEvent[] = [];
  #subscribers: Set<Subscription> = new Set();
  #config: Required<EventLogConfig>;
  #closed = false;
  #snapshots = new Map<string, Map<number, unknown>>();

  constructor(config: EventLogConfig = {}) {
    this.#config = {
      maxEvents: config.maxEvents ?? 100000,
      maxEventSize: config.maxEventSize ?? 1024 * 1024,
    };
  }

  async append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent> {
    if (this.#closed) {
      throw new EventLogError('UNAVAILABLE', 'Event log is closed');
    }

    validatePayload(event.type, event.payload);

    const fullEvent: CognitiveEvent = {
      ...event,
      id: ulid(),
      timestamp: Date.now(),
    } as CognitiveEvent;

    const eventSize = JSON.stringify(fullEvent).length;
    if (eventSize > this.#config.maxEventSize) {
      throw new EventLogError('INVALID_EVENT', `Event size ${eventSize} exceeds max ${this.#config.maxEventSize}`);
    }

    if (this.#events.length >= this.#config.maxEvents) {
      throw new EventLogError('FULL', `Event log full (${this.#config.maxEvents} events)`);
    }

    this.#events.push(fullEvent);
    this.#notifySubscribers(fullEvent);

    return fullEvent;
  }

  #notifySubscribers(event: CognitiveEvent): void {
    for (const sub of this.#subscribers) {
      if (sub.fromId && sub.fromId >= event.id) continue;
      if (sub.types && !sub.types.has(event.type)) continue;
      if (sub.filter && !sub.filter(event)) continue;
      sub.queue.push(event);
      if (sub.resolver) {
        const resolver = sub.resolver;
        sub.resolver = null;
        resolver({ value: event, done: false });
      }
    }
  }

  subscribe(options?: {
    filter?: (event: CognitiveEvent) => boolean;
    fromId?: string;
    types?: string[];
  }): AsyncIterable<CognitiveEvent> {
    const typesSet = options?.types ? new Set(options.types) : undefined;
    const queue: CognitiveEvent[] = [];
    let closed = false;

    const subscription: Subscription = {
      filter: options?.filter,
      fromId: options?.fromId,
      types: typesSet,
      queue,
      resolver: null,
    };

    this.#subscribers.add(subscription);

    if (options?.fromId) {
      const fromId = options.fromId;
      const startIdx = this.#events.findIndex(e => e.id > fromId);
      if (startIdx >= 0) {
        for (let i = startIdx; i < this.#events.length; i++) {
          const event = this.#events[i];
          if (!event) continue;
          if (typesSet && !typesSet.has(event.type)) continue;
          if (options.filter && !options.filter(event)) continue;
          queue.push(event);
        }
      }
    }

    const subscribers = this.#subscribers;

    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<CognitiveEvent>> {
            while (queue.length > 0) {
              const nextEvent = queue.shift();
              if (nextEvent) return { value: nextEvent, done: false };
            }
            if (closed) {
              return { value: undefined, done: true };
            }
            return new Promise<IteratorResult<CognitiveEvent>>((res) => {
              subscription.resolver = res;
            });
          },
          async return(): Promise<IteratorResult<CognitiveEvent>> {
            closed = true;
            subscribers.delete(subscription);
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  async getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]> {
    const startIdx = this.#events.findIndex(e => e.id > fromId);
    if (startIdx < 0) return [];

    let endIdx = this.#events.length;
    if (toId) {
      const foundIdx = this.#events.findIndex(e => e.id > toId);
      if (foundIdx >= 0) endIdx = foundIdx;
    }

    return this.#events.slice(startIdx, endIdx);
  }

  async getSnapshot<T>(projectionName: string, version: number): Promise<T | null> {
    const versions = this.#snapshots.get(projectionName);
    if (!versions) return null;
    const data = versions.get(version);
    return (data ?? null) as T | null;
  }

  async saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void> {
    let versions = this.#snapshots.get(projectionName);
    if (!versions) {
      versions = new Map();
      this.#snapshots.set(projectionName, versions);
    }
    versions.set(version, data);
  }

  async close(): Promise<void> {
    this.#closed = true;
    for (const sub of this.#subscribers) {
      if (sub.resolver) sub.resolver({ value: undefined, done: true });
    }
    this.#subscribers.clear();
  }

  get size(): number {
    return this.#events.length;
  }

  get events(): ReadonlyArray<CognitiveEvent> {
    return this.#events;
  }
}