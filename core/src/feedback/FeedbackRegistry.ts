import { BoundedRing, mean } from '@senars/util';

export interface FeedbackEntry {
  readonly source: 'tool' | 'engine' | 'human';
  readonly target: string;
  readonly result: import('../engine/Engine.js').ToolResult;
  readonly timestamp: number;
  readonly correlationId: string;
}

const MAX_ENTRIES = 10000;
/** Per-target windows are bounded independently so one noisy target cannot
 *  evict the global history (and neither map can grow without limit). */
const MAX_PER_TARGET = 1000;

export class FeedbackRegistry {
  readonly #entries = new BoundedRing<FeedbackEntry>(MAX_ENTRIES);
  readonly #byTarget = new Map<string, BoundedRing<FeedbackEntry>>();

  record(entry: FeedbackEntry): void {
    this.#entries.push(entry);
    const ring = this.#byTarget.get(entry.target) ?? new BoundedRing<FeedbackEntry>(MAX_PER_TARGET);
    ring.push(entry);
    this.#byTarget.set(entry.target, ring);
  }

  getForTarget(target: string): FeedbackEntry[] {
    return this.#byTarget.get(target)?.toArray() ?? [];
  }

  getRecent(limit: number): FeedbackEntry[] {
    return this.#entries.tail(limit);
  }

  getSuccessRate(target: string): number {
    const e = this.getForTarget(target);
    return e.length ? mean(e, (x) => Number(x.result.success)) : 1;
  }

  clear(): void {
    this.#entries.clear();
    this.#byTarget.clear();
  }
}
