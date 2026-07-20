export interface FeedbackEntry {
  readonly source: 'tool' | 'engine' | 'human';
  readonly target: string;
  readonly result: import('../engine/Engine.js').ToolResult;
  readonly timestamp: number;
  readonly correlationId: string;
}

export class FeedbackRegistry {
  #entries: FeedbackEntry[] = [];
  #byTarget = new Map<string, FeedbackEntry[]>();
  #max = 10000;

  record(entry: FeedbackEntry): void {
    this.#entries.push(entry);
    const arr = this.#byTarget.get(entry.target) ?? [];
    arr.push(entry);
    this.#byTarget.set(entry.target, arr);
    if (this.#entries.length > this.#max) this.#entries.shift();
  }

  getForTarget(target: string): FeedbackEntry[] {
    return this.#byTarget.get(target) ?? [];
  }

  getRecent(limit: number): FeedbackEntry[] {
    return this.#entries.slice(-limit);
  }

  getSuccessRate(target: string): number {
    const e = this.#byTarget.get(target) ?? [];
    return e.length ? e.filter((x) => x.result.success).length / e.length : 1;
  }

  clear(): void {
    this.#entries = [];
    this.#byTarget.clear();
  }
}
