import { getOrInsert } from '@senars/util';
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
    const types = query.types?.length ? new Set(query.types) : undefined;
    const { correlationId, timeRange, limit } = query;
    const { events } = this;

    // `limit` keeps the most recent matches, so the scan runs backwards and stops
    // as soon as the cap is covered: it allocates at most `limit` entries and
    // reads no older event than it has to. Forward-with-early-exit would return
    // the oldest `limit` matches, and forward-without it would materialize every
    // match in the log before `takeLast` threw most of them away.
    const matches: CognitiveEvent[] = [];
    for (
      let i = events.length - 1;
      i >= 0 && (limit === undefined || matches.length < limit);
      i--
    ) {
      const e = events[i]!;
      if (correlationId && e.correlationId !== correlationId) continue;
      if (types && !types.has(e.type)) continue;
      if (timeRange && (e.timestamp < timeRange[0] || e.timestamp > timeRange[1])) continue;
      matches.push(e);
    }

    return matches.reverse();
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
