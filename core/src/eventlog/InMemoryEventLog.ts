import { ulid } from 'ulid';
import { AbstractEventLog } from './AbstractEventLog.js';
import type { EventLog, EventLogConfig, CognitiveEvent } from './EventLog.js';
import { EventLogError } from './EventLog.js';

export class InMemoryEventLog extends AbstractEventLog {
  #events: CognitiveEvent[] = [];
  #config: Required<EventLogConfig>;
  #closed = false;

  constructor(config: EventLogConfig = {}) {
    super();
    this.#config = {
      maxEvents: config.maxEvents ?? 100000,
      maxEventSize: config.maxEventSize ?? 1024 * 1024,
    };
  }

  generateId(): string {
    return ulid();
  }

  protected async doAppend(fullEvent: CognitiveEvent): Promise<void> {
    if (this.#closed) {
      throw new EventLogError('UNAVAILABLE', 'Event log is closed');
    }

    const eventSize = JSON.stringify(fullEvent).length;
    if (eventSize > this.#config.maxEventSize) {
      throw new EventLogError('INVALID_EVENT', `Event size ${eventSize} exceeds max ${this.#config.maxEventSize}`);
    }

    if (this.#events.length >= this.#config.maxEvents) {
      throw new EventLogError('FULL', `Event log full (${this.#config.maxEvents} events)`);
    }

    this.#events.push(fullEvent);
    this.notify(fullEvent);
  }

  async getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]> {
    const startIdx = this.#events.findIndex((e) => (e.id ?? '') > fromId);
    if (startIdx < 0) return [];

    let endIdx = this.#events.length;
    if (toId) {
      const foundIdx = this.#events.findIndex((e) => (e.id ?? '') > toId);
      if (foundIdx >= 0) endIdx = foundIdx;
    }

    return this.#events.slice(startIdx, endIdx);
  }

  async close(): Promise<void> {
    this.#closed = true;
  }

  get size(): number {
    return this.#events.length;
  }

  get events(): ReadonlyArray<CognitiveEvent> {
    return this.#events;
  }
}