import { AbstractEventLog } from './AbstractEventLog.js';
import type { CognitiveEvent, EventLogConfig, EventLogQuery } from './EventLog.js';

export class InMemoryEventLog extends AbstractEventLog {
  #events: CognitiveEvent[] = [];

  constructor(config: EventLogConfig = {}) {
    super(config);
  }

  get size(): number {
    return this.#events.length;
  }

  get events(): ReadonlyArray<CognitiveEvent> {
    return this.#events;
  }

  async query(query: EventLogQuery): Promise<CognitiveEvent[]> {
    let matches = this.#events.filter((e) => {
      if (query.correlationId && e.correlationId !== query.correlationId) return false;
      if (query.types && !query.types.includes(e.type)) return false;
      if (query.timeRange) {
        const [start, end] = query.timeRange;
        if (e.timestamp < start || e.timestamp > end) return false;
      }
      return true;
    });
    if (query.limit !== undefined && matches.length > query.limit) {
      matches = matches.slice(-query.limit);
    }
    return matches;
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

  protected async doAppend(fullEvent: CognitiveEvent): Promise<void> {
    this.assertAppendable(fullEvent, this.#events.length >= this.limits.maxEvents);
    this.#events.push(fullEvent);
  }
}
