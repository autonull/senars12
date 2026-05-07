export type SamplingObjective = 
    | { type: 'priority'; threshold: number }
    | { type: 'recency'; windowMs: number }
    | { type: 'novelty'; maxDepth: number }
    | { type: 'composite'; weights: { priority: number; recency: number; novelty: number } };

interface BagItem<T> {
    item: T;
    priority: number;
    lastAccess: number;
}

export class BoundedBag<T> {
    private heap: BagItem<T>[] = [];
    private accessLog = new Map<T, number>();
    private _capacity: number;

    constructor(capacity: number) {
        this._capacity = capacity;
    }

add(item: T, priority: number): boolean {
    if (this.heap.length >= this._capacity) {
      const minP = this.findMinPriority();
      if (priority <= minP) return false;
      this.heap.shift();
    }

    const entry: BagItem<T> = { item, priority, lastAccess: Date.now() };
    this.accessLog.set(item, entry.lastAccess);
    const idx = this.heap.findIndex(h => h.priority < priority);
    idx === -1
      ? this.heap.push(entry)
      : this.heap.splice(idx, 0, entry);
    return true;
  }

  sample(objective: SamplingObjective): T | undefined {
    switch (objective.type) {
      case 'priority': {
        const found = this.heap.find(h => (h as any).priority >= objective.threshold);
        return found?.item;
      }
      case 'recency': {
        const cutoff = Date.now() - objective.windowMs;
        const found = this.heap.find(h => h.lastAccess >= cutoff);
        return found?.item;
      }
      case 'novelty':
        return this.heap[0]?.item;
      case 'composite': {
        const scored = this.heap.map(h => ({
          item: h.item,
          score: (h as any).priority * objective.weights.priority - (Date.now() - (h as any).lastAccess) / 1000 * objective.weights.recency
        }));
        if (scored.length > 0) {
          const best = scored.toSorted((a, b) => b.score - a.score)[0];
          return best?.item;
        }
        return undefined;
      }
    }
  }

  consolidate(currentTime: number, ttl: number): void {
    this.heap = this.heap.filter(entry => currentTime - entry.lastAccess <= ttl);
  }

  get size(): number {
    return this.heap.length;
  }

  clear(): void {
    this.heap = [];
  }

  private findMinPriority(): number {
    if (this.heap.length === 0) return 0;
    let minP = Infinity;
    for (const { priority } of this.heap) if (priority < minP) minP = priority;
    return minP;
  }
}