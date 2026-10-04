import { getOrInsert, takeLast } from '@senars/util';
import { AbstractEventLog } from './AbstractEventLog.js';
import type { CognitiveEvent, EventLogConfig, EventLogQuery } from './EventLog.js';

export class InMemoryEventLog extends AbstractEventLog {
  #events: CognitiveEvent[] = [];
  #snapshots = new Map<string, Map<number, unknown>>();

  constructor(config: EventLogConfig = {}) {
    super(config);
  }

  getSnapshot<T>(projectionName: string, version: number): Promise<T | null> {
    return Promise.resolve((this.#snapshots.get(projectionName)?.get(version) as T) ?? null);
  }

  saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void> {
    getOrInsert(this.#snapshots, projectionName, () => new Map()).set(version, data);
    return Promise.resolve();
  }

  get size(): number {
    return this.#events.length;
  }

  get events(): ReadonlyArray<CognitiveEvent> {
    return this.#events;
  }

  async query(query: EventLogQuery): Promise<CognitiveEvent[]> {
    const matches = this.#events.filter((e) => {
      if (query.correlationId && e.correlationId !== query.correlationId) return false;
      if (query.types && !query.types.includes(e.type)) return false;
      if (query.timeRange) {
        const [start, end] = query.timeRange;
        if (e.timestamp < start || e.timestamp > end) return false;
      }
      return true;
    });
    return query.limit === undefined ? matches : takeLast(matches, query.limit);
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

  protected async doAppend(fullEvent: CognitiveEvent, payloadJson: string): Promise<void> {
    this.assertAppendable(payloadJson, this.#events.length >= this.limits.maxEvents);
    this.#events.push(fullEvent);
  }
}
