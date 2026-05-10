export type SamplingObjective =
    | { type: 'priority'; threshold: number }
    | { type: 'recency'; windowMs: number }
    | { type: 'novelty'; maxDepth: number }
    | { type: 'composite'; weights: { priority: number; recency: number; novelty: number } };

export type OverflowBehavior = 'reject' | 'replace-lowest' | 'merge';

export interface BagStatistics {
    size: number;
    capacity: number;
    utilization: number;
    priorityDistribution: { min: number; max: number; avg: number; median: number };
    ageHistogram: { buckets: { min: number; max: number; count: number }[] };
    throughput: { additions: number; removals: number; hits: number; misses: number };
}

export interface BoundedBagState<T> {
    items: { item: T; priority: number; lastAccess: number; createdAt: number }[];
    capacity: number;
    overflowBehavior: OverflowBehavior;
    stats: { additions: number; removals: number; hits: number; misses: number };
}

interface BagItem<T> {
    item: T;
    priority: number;
    lastAccess: number;
    createdAt: number;
}

export class BoundedBag<T> {
    private heap: BagItem<T>[] = [];
    private accessLog = new Map<T, number>();
    private readonly _capacity: number;
    private readonly overflowBehavior: OverflowBehavior = 'reject';
    private stats = {additions: 0, removals: 0, hits: 0, misses: 0};
    private onOverflow?: (item: T, priority: number, bag: BoundedBag<T>) => void;

    constructor(
        capacity: number,
        options?: {
            overflowBehavior?: OverflowBehavior;
            onOverflow?: (item: T, priority: number, bag: BoundedBag<T>) => void;
        }
    ) {
        this._capacity = capacity;
        if (options?.overflowBehavior) {
            this.overflowBehavior = options.overflowBehavior;
        }
        if (options?.onOverflow) {
            this.onOverflow = options.onOverflow;
        }
    }

    get size(): number {
        return this.heap.length;
    }

    get capacity(): number {
        return this._capacity;
    }

    static deserialize<T>(state: BoundedBagState<T>): BoundedBag<T> {
        const bag = new BoundedBag<T>(state.capacity, {overflowBehavior: state.overflowBehavior});
        for (const {item, priority, lastAccess, createdAt} of state.items) {
            bag.heap.push({item, priority, lastAccess, createdAt});
            bag.accessLog.set(item, lastAccess);
        }
        bag.stats = {...state.stats};
        return bag;
    }

    add(item: T, priority: number): boolean {
        const entry: BagItem<T> = {item, priority, lastAccess: Date.now(), createdAt: Date.now()};

        if (this.heap.length >= this._capacity) {
            this.stats.misses++;
            if (this.overflowBehavior === 'reject') {
                const minP = this.findMinPriority();
                if (priority <= minP) return false;
                this.heap.shift();
    } else if (this.overflowBehavior === 'replace-lowest') {
      const minIdx = this.findMinIndex();
      const minItem = this.heap[minIdx];
      if (minIdx >= 0 && minItem && priority > minItem.priority) {
        this.heap.splice(minIdx, 1);
      } else {
        return false;
      }
            } else if (this.overflowBehavior === 'merge') {
                const existing = this.heap.find(h => this.itemsMatch(h.item, item));
                if (existing) {
                    existing.priority = Math.max(existing.priority, priority);
                    existing.lastAccess = Date.now();
                    this.stats.additions++;
                    return true;
                }
                const minP = this.findMinPriority();
                if (priority <= minP) return false;
                this.heap.shift();
            }
        } else {
            this.stats.additions++;
        }

        this.accessLog.set(item, entry.lastAccess);
        const idx = this.heap.findIndex(h => h.priority < priority);
        idx === -1 ? this.heap.push(entry) : this.heap.splice(idx, 0, entry);
        return true;
    }

    addMany(items: Array<[T, number]>): number {
        let added = 0;
        for (const [item, priority] of items) {
            if (this.add(item, priority)) added++;
        }
        return added;
    }

    removeMany(predicate: (item: T) => boolean): number {
        let removed = 0;
        this.heap = this.heap.filter(entry => {
            if (predicate(entry.item)) {
                removed++;
                this.stats.removals++;
                return false;
            }
            return true;
        });
        return removed;
    }

    getStatistics(): BagStatistics {
        const priorities = this.heap.map(h => h.priority);
        const ages = this.heap.map(h => Date.now() - h.createdAt);

        const priorityDist = {
            min: priorities.length > 0 ? Math.min(...priorities) : 0,
            max: priorities.length > 0 ? Math.max(...priorities) : 0,
            avg: priorities.length > 0 ? priorities.reduce((a, b) => a + b, 0) / priorities.length : 0,
            median:
                priorities.length > 0
                    ? [...priorities].sort((a, b) => a - b)[Math.floor(priorities.length / 2)] ?? 0
                    : 0,
        };

        const ageBuckets = [
            {min: 0, max: 60_000, count: 0},
            {min: 60_000, max: 300_000, count: 0},
            {min: 300_000, max: 900_000, count: 0},
            {min: 900_000, max: Infinity, count: 0},
        ];

        for (const age of ages) {
            const bucket = ageBuckets.find(b => age >= b.min && age < b.max);
            if (bucket) bucket.count++;
        }

        return {
            size: this.heap.length,
            capacity: this._capacity,
            utilization: this.heap.length / this._capacity,
            priorityDistribution: priorityDist,
            ageHistogram: {buckets: ageBuckets},
            throughput: {...this.stats},
        };
    }

    serialize(): BoundedBagState<T> {
        return {
            items: this.heap.map(({item, priority, lastAccess, createdAt}) => ({
                item,
                priority,
                lastAccess,
                createdAt,
            })),
            capacity: this._capacity,
            overflowBehavior: this.overflowBehavior,
            stats: {...this.stats},
        };
    }

    private sampleStrategies: Record<string, (objective: any) => T | undefined> = {
        priority: (objective) => {
            const found = this.heap.find(h => h.priority >= objective.threshold);
            if (found) {
                this.stats.hits++;
                return found.item;
            }
            this.stats.misses++;
            return undefined;
        },
        recency: (objective) => {
            const cutoff = Date.now() - objective.windowMs;
            const found = this.heap.find(h => h.lastAccess >= cutoff);
            if (found) {
                this.stats.hits++;
                return found.item;
            }
            this.stats.misses++;
            return undefined;
        },
        novelty: () => {
            this.stats.hits++;
            return this.heap[0]?.item;
        },
        composite: (objective) => {
            const scored = this.heap.map(h => ({
                item: h.item,
                score: h.priority * objective.weights.priority - ((Date.now() - h.lastAccess) / 1000) * objective.weights.recency,
            }));
            if (scored.length > 0) {
                const best = [...scored].sort((a, b) => b.score - a.score)[0];
                if (best) {
                    this.stats.hits++;
                    return best.item;
                }
            }
            this.stats.misses++;
            return undefined;
        }
    };

    sample(objective: SamplingObjective): T | undefined {
        return this.sampleStrategies[objective.type]?.(objective);
    }

    consolidate(currentTime: number, ttl: number): void {
        this.heap = this.heap.filter(entry => currentTime - entry.lastAccess <= ttl);
    }

    clear(): void {
        this.heap = [];
        this.accessLog.clear();
        this.stats = {additions: 0, removals: 0, hits: 0, misses: 0};
    }

    private findMinPriority(): number {
        if (this.heap.length === 0) return 0;
        let minP = Infinity;
        for (const {priority} of this.heap) {
            if (priority < minP) minP = priority;
        }
        return minP;
    }

  private findMinIndex(): number {
    if (this.heap.length === 0) return -1;
    let minIdx = 0;
    let minP = this.heap[0]!.priority;
    for (let i = 1; i < this.heap.length; i++) {
      const item = this.heap[i];
      if (item && item.priority < minP) {
        minP = item.priority;
        minIdx = i;
      }
    }
    return minIdx;
  }

    private itemsMatch(a: T, b: T): boolean {
        if (a == null || b == null) return a === b;
        if (typeof a === 'object' && typeof b === 'object') {
            if ('hash' in a && 'hash' in b) {
                const aObj = a as Record<string, unknown>;
                const bObj = b as Record<string, unknown>;
                if (aObj.hash !== bObj.hash) return false;
                const aKind = aObj['kind'], bKind = bObj['kind'];
                if (aKind !== undefined && bKind !== undefined && aKind !== bKind) return false;
                const aArgs = aObj['args'], bArgs = bObj['args'];
                if (Array.isArray(aArgs) && Array.isArray(bArgs) && aArgs.length !== bArgs.length) return false;
                return true;
            }
            return JSON.stringify(a) === JSON.stringify(b);
        }
        return a === b;
    }
}
