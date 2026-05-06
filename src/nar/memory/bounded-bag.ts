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
    this.heap.push(entry);
    this.heap.sort((a, b) => b.priority - a.priority);
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
          scored.sort((a, b) => b.score - a.score);
          return scored[0]?.item;
        }
        return undefined;
      }
    }
  }

    consolidate(currentTime: number, ttl: number): void {
        const toRemove: number[] = [];

        for (let i = 0; i < this.heap.length; i++) {
            const entry = this.heap[i];
            if (!entry) continue;
            const lastAccess = entry.lastAccess;
            if (currentTime - lastAccess > ttl) {
                toRemove.push(i);
            }
        }

        for (let i = toRemove.length - 1; i >= 0; i--) {
            const idx = toRemove[i];
            if (typeof idx === 'number') {
                this.heap.splice(idx, 1);
            }
        }
    }

    get size(): number {
        return this.heap.length;
    }

    clear(): void {
        this.heap = [];
    }

    private findMinPriority(): number {
        if (this.heap.length === 0) return 0;
        return Math.min(...this.heap.map(h => h.priority));
    }
}