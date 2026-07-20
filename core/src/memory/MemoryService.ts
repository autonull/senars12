import type { Engine } from '../engine/Engine.js';
import type { EventLog } from '../eventlog/EventLog.js';
import { generateId } from '../helpers.js';
import type { ToolRegistry } from '../motor/ToolRegistry.js';
import type { MemoryEntry, MemoryQuery } from './types.js';

export class MemoryService {
  #working: MemoryEntry[] = [];
  #maxWorking = 1000;
  #log?: EventLog;
  #engines?: Map<string, Engine>;
  #motor?: ToolRegistry;
  #tiers = new Map<string, unknown>();

  setMaxWorking(max: number): void {
    this.#maxWorking = max;
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
    if (this.#working.length > this.#maxWorking) {
      this.#working = this.#working.slice(-this.#maxWorking);
    }
  }

  recent(limit: number, type?: string): MemoryEntry[] {
    const entries = type ? this.#working.filter((e) => e.type === type) : this.#working;
    return entries.slice(-limit);
  }

  query(q: MemoryQuery): MemoryEntry[] {
    let result = this.#working;
    if (q.type) result = result.filter((e) => e.type === q.type);
    const from = q.from;
    if (from !== undefined) result = result.filter((e) => e.timestamp >= from);
    const to = q.to;
    if (to !== undefined) result = result.filter((e) => e.timestamp <= to);
    const limit = q.limit ?? result.length;
    return result.slice(-limit);
  }

  queryTimeRange(from: number, to: number): MemoryEntry[] {
    return this.#working.filter((e) => e.timestamp >= from && e.timestamp <= to);
  }

  queryAroundTime(ts: number, windowMs: number): MemoryEntry[] {
    return this.#working.filter((e) => Math.abs(e.timestamp - ts) <= windowMs);
  }

  /** Tier 1: Episodic memory via EventLog replay */
  async queryEpisodic(from?: number, to?: number, types?: string[]): Promise<MemoryEntry[]> {
    if (!this.#log) return [];
    try {
      const events = await this.#log.getRange('', '');
      return events
        .filter((e) => {
          if (types && types.length > 0 && !types.includes(e.type)) return false;
          if (from !== undefined && e.timestamp < from) return false;
          if (to !== undefined && e.timestamp > to) return false;
          return true;
        })
        .map((e) => ({
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
  getProceduralFeedback(): import('../motor/ToolRegistry.js').SkillFeedback[] {
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
    this.#working = [];
  }

  get size(): number {
    return this.#working.length;
  }

  get all(): readonly MemoryEntry[] {
    return this.#working;
  }

  get connectedEngines(): Map<string, Engine> | undefined {
    return this.#engines;
  }
}
