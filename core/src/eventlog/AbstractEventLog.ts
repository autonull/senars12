import { generateId } from '../helpers.js';
import type { EventLog, EventLogConfig, CognitiveEvent } from './EventLog.js';

export abstract class AbstractEventLog implements EventLog {
  #subscribers = new Set<Subscription>();
  #snapshots = new Map<string, Map<number, unknown>>();
  #closed = false;

  abstract generateId(): string;
  protected abstract doAppend(event: CognitiveEvent): Promise<void>;
  abstract getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]>;
  abstract close(): Promise<void>;
  abstract get size(): number;
  abstract get events(): ReadonlyArray<CognitiveEvent>;

  async append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent> {
    if (this.#closed) {
      throw new Error('Event log is closed');
    }
    this.validatePayload(event.type, event.payload);
    const full = {
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
    } as CognitiveEvent;
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
    const queue: CognitiveEvent[] = [];
    let closed = false;

    const subscription: Subscription = {
      filter: options?.filter,
      fromId: options?.fromId,
      types: typesSet,
      queue,
      closed: false,
      resolver: null,
    };

    this.#subscribers.add(subscription);

    if (options?.fromId) {
      this.getRange(options.fromId).then((events) => {
        for (const event of events) {
          if (typesSet && !typesSet.has(event.type)) continue;
          if (options.filter && !options.filter(event)) continue;
          queue.push(event);
        }
      });
    }

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
            subscription.closed = true;
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  getSnapshot<T>(projectionName: string, version: number): Promise<T | null> {
    return Promise.resolve((this.#snapshots.get(projectionName)?.get(version) as T) ?? null);
  }

  saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void> {
    const map = this.#snapshots.get(projectionName) ?? new Map();
    map.set(version, data);
    this.#snapshots.set(projectionName, map);
    return Promise.resolve();
  }

  notify(event: CognitiveEvent): void {
    for (const sub of this.#subscribers) {
      if (!sub.closed) {
        try {
          if (sub.fromId && sub.fromId >= (event.id ?? '')) continue;
          if (sub.types && !sub.types.has(event.type)) continue;
          if (sub.filter && !sub.filter(event)) continue;
          sub.queue.push(event);
          if (sub.resolver) {
            const resolver = sub.resolver;
            sub.resolver = null;
            resolver({ value: event, done: false });
          }
        } catch {
          // ignore handler errors
        }
      }
    }
  }

  protected validatePayload(type: string, payload: unknown): void {
    // Base validation - override in subclasses if needed
  }
}

interface Subscription {
  filter?: (event: CognitiveEvent) => boolean;
  fromId?: string;
  types?: Set<string>;
  queue: CognitiveEvent[];
  closed: boolean;
  resolver: ((value: IteratorResult<CognitiveEvent>) => void) | null;
}