import { generateId } from '../helpers.js';
import type { MemoryEntry, MemoryQuery } from './types.js';

export class MemoryService {
  #working: MemoryEntry[] = [];
  #maxWorking = 1000;

  setMaxWorking(max: number): void {
    this.#maxWorking = max;
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
    const entries = type
      ? this.#working.filter((e) => e.type === type)
      : this.#working;
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
    return this.#working.filter(
      (e) => Math.abs(e.timestamp - ts) <= windowMs
    );
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
}
