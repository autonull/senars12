import { BoundedRing, generateId, takeLast } from '@senars/util';
import type { Engine } from '../engine/Engine.js';
import type { EventLog } from '../eventlog/EventLog.js';
import type { SkillFeedback, ToolRegistry } from '../motor/ToolRegistry.js';
import type { MemoryEntry, MemoryQuery } from './types.js';
import { RECALL_WINDOW, WORKING_MEMORY_CAPACITY } from './types.js';

export class MemoryService {
  /**
   * The working tier is a bounded ring, like every other bounded structure in the
   * kernel, so it reports `pressure()` and evicts by the same rule rather than by
   * a bare `pushCapped` against a private `#maxWorking`.
   */
  #working = new BoundedRing<MemoryEntry>(WORKING_MEMORY_CAPACITY);
  #log?: EventLog;
  #engines?: Map<string, Engine>;
  #motor?: ToolRegistry;
  #tiers = new Map<string, unknown>();

  get size(): number {
    return this.#working.size();
  }

  get all(): readonly MemoryEntry[] {
    return this.#working.toArray();
  }

  /** Occupancy of the working tier, `0..1` — the AIKR pressure signal. */
  pressure(): number {
    return this.#working.pressure();
  }

  get connectedEngines(): Map<string, Engine> | undefined {
    return this.#engines;
  }

  /** Resize the working tier, keeping the most recent entries that still fit. */
  setMaxWorking(max: number): void {
    const kept = this.#working.tail(max);
    this.#working = new BoundedRing<MemoryEntry>(Math.max(1, max));
    for (const entry of kept) this.#working.push(entry);
  }

  /** Connect the EventLog for Tier 1 (episodic) queries */
  connectLog(log: EventLog): void {
    this.#log = log;
  }

  /** Connect engines for Tier 2 (semantic) queries */
  connectEngines(engines: Map<string, Engine>): void {
    this.#engines = engines;
  }

  /** Connect ToolRegistry for Tier 3 (procedural) feedback */
  connectMotor(motor: ToolRegistry): void {
    this.#motor = motor;
  }

  append(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): void {
    const full: MemoryEntry = {
      ...entry,
      id: generateId('mem'),
      timestamp: Date.now(),
    };
    this.#working.push(full);
  }

  recent(limit: number, type?: string): MemoryEntry[] {
    return type
      ? takeLast(
          this.#working.filter((e) => e.type === type),
          limit
        )
      : this.#working.tail(limit);
  }

  query(q: MemoryQuery): MemoryEntry[] {
    const { type, from, to, limit } = q;
    const inRange = (e: MemoryEntry): boolean =>
      (!type || e.type === type) &&
      (from === undefined || e.timestamp >= from) &&
      (to === undefined || e.timestamp <= to);
    const matched = this.#working.filter(inRange);
    return takeLast(matched, limit ?? matched.length);
  }

  queryTimeRange(from: number, to: number): MemoryEntry[] {
    return this.#working.filter((e) => e.timestamp >= from && e.timestamp <= to);
  }

  queryAroundTime(ts: number, windowMs: number): MemoryEntry[] {
    return this.#working.filter((e) => Math.abs(e.timestamp - ts) <= windowMs);
  }

  /** Tier 1: Episodic memory via the log's own filtered read. */
  async queryEpisodic(
    from?: number,
    to?: number,
    types?: string[],
    limit = RECALL_WINDOW
  ): Promise<MemoryEntry[]> {
    if (!this.#log) return [];
    try {
      // `timestamp` is a positive integer (see `CognitiveEventBaseSchema`), so the
      // open ends of a half-given range are 0 and `MAX_SAFE_INTEGER` — a range
      // the store can filter on, rather than a predicate that drops back to a
      // full-log read in JavaScript.
      const events = await this.#log.query({
        types,
        timeRange:
          from === undefined && to === undefined
            ? undefined
            : [from ?? 0, to ?? Number.MAX_SAFE_INTEGER],
        limit,
      });
      return events.map((e) => ({
        id: e.id ?? `event-${e.timestamp}`,
        type: e.type,
        payload: e.payload,
        timestamp: e.timestamp,
        correlationId: e.correlationId,
      }));
    } catch {
      return [];
    }
  }

  /** Tier 2: Semantic memory via engines */
  async querySemantic(pattern: string): Promise<unknown[]> {
    if (!this.#engines) return [];
    const results: unknown[] = [];
    for (const engine of this.#engines.values()) {
      try {
        const engineResults = await engine.query(pattern);
        results.push(...engineResults);
      } catch {
        // engine unavailable
      }
    }
    return results;
  }

  /** Tier 3: Procedural memory — tool feedback */
  getProceduralFeedback(): SkillFeedback[] {
    return this.#motor?.getAllFeedback() ?? [];
  }

  /** Tier 4: Long-term persistence */
  async persist(): Promise<void> {
    for (const engine of this.#engines?.values() ?? []) {
      try {
        await engine.persist?.();
      } catch {
        /* ignore */
      }
    }
  }

  async load(): Promise<void> {
    for (const engine of this.#engines?.values() ?? []) {
      try {
        await engine.load?.();
      } catch {
        /* ignore */
      }
    }
  }

  /** Register an additional memory tier (e.g. vector store via plugin). */
  addTier(name: string, impl: unknown): void {
    this.#tiers.set(name, impl);
  }

  getTier(name: string): unknown {
    return this.#tiers.get(name);
  }

  /** Consolidate: promote high-salience entries to semantic via engines */
  async consolidate(_correlationId: string): Promise<void> {
    // Future: promote successful patterns, high-confidence derivations
  }

  clear(): void {
    this.#working.clear();
  }
}
