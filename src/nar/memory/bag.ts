export interface BagItem<T> {
    item: T;
    priority: number;
    lastAccess: number;
    createdAt: number;
}

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

const statsFromValues = (values: number[]) => {
    if (values.length === 0) return {min: 0, max: 0, avg: 0, median: 0};
    const sorted = [...values].sort((a, b) => a - b);
    return {
        min: Math.min(...values), max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        median: sorted[Math.floor(sorted.length / 2)] ?? 0
    };
};

const AGE_BUCKETS = [
    {min: 0, max: 60_000, count: 0},
    {min: 60_000, max: 300_000, count: 0},
    {min: 300_000, max: 900_000, count: 0},
    {min: 900_000, max: Infinity, count: 0}
] as const;

const SAMPLE_FN: Record<string, (heap: BagItem<unknown>[], obj: Record<string, unknown>) => unknown> = {
    priority: (h, o) => h.find(e => e.priority >= (o.threshold as number))?.item,
    recency: (h, o) => {
        const cutoff = Date.now() - (o.windowMs as number);
        return h.find(e => e.lastAccess >= cutoff)?.item;
    },
    novelty: h => h[0]?.item,
    composite: (h, o) => {
        const w = o.weights as { priority: number; recency: number };
        const scored = h.map(e => ({
            item: e.item,
            score: e.priority * w.priority - ((Date.now() - e.lastAccess) / 1000) * w.recency
        }));
        return scored.length > 0 ? [...scored].sort((a, b) => b.score - a.score)[0]?.item : undefined;
    }
};

export class Bag<T> {
    private heap: BagItem<T>[] = [];
    private readonly _capacity: number;
    private readonly overflowBehavior: OverflowBehavior;
    private stats = {additions: 0, removals: 0, hits: 0, misses: 0};
    private onOverflow?: (item: T, priority: number, bag: Bag<T>) => void;

    constructor(capacity: number, options?: {
        overflowBehavior?: OverflowBehavior;
        onOverflow?: (item: T, priority: number, bag: Bag<T>) => void
    }) {
        this._capacity = capacity;
        this.overflowBehavior = options?.overflowBehavior ?? 'reject';
        this.onOverflow = options?.onOverflow;
    }

    get size(): number {
        return this.heap.length;
    }

    get capacity(): number {
        return this._capacity;
    }

    static deserialize<T>(state: BoundedBagState<T>): Bag<T> {
        const bag = new Bag<T>(state.capacity, {overflowBehavior: state.overflowBehavior});
        for (const {item, priority, lastAccess, createdAt} of state.items) bag.heap.push({
            item,
            priority,
            lastAccess,
            createdAt
        });
        bag.stats = {...state.stats};
        return bag;
    }

    add(item: T, priority: number): boolean {
        if (this._capacity === 0) {
            this.stats.misses++;
            return false;
        }

        const entry: BagItem<T> = {item, priority, lastAccess: Date.now(), createdAt: Date.now()};

        if (this.heap.length >= this._capacity) {
            this.stats.misses++;
            if (!this.handleOverflow(priority)) return false;
        } else {
            this.stats.additions++;
        }

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
        const buckets = AGE_BUCKETS.map(b => ({...b}));
        for (const age of ages) buckets.find(b => age >= b.min && age < b.max)!.count++;

        return {
            size: this.heap.length, capacity: this._capacity, utilization: this.heap.length / this._capacity,
            priorityDistribution: statsFromValues(priorities), ageHistogram: {buckets},
            throughput: {...this.stats}
        };
    }

    serialize(): BoundedBagState<T> {
        return {
            items: this.heap.map(({item, priority, lastAccess, createdAt}) => ({
                item,
                priority,
                lastAccess,
                createdAt
            })),
            capacity: this._capacity, overflowBehavior: this.overflowBehavior, stats: {...this.stats}
        };
    }

    sample(objective: SamplingObjective): T | undefined {
        const strategy = SAMPLE_FN[objective.type];
        if (!strategy) return undefined;
        const result = strategy(this.heap, objective);
        this.stats[result ? 'hits' : 'misses']++;
        return result as T | undefined;
    }

    consolidate(currentTime: number, ttl: number): void {
        this.heap = this.heap.filter(entry => currentTime - entry.lastAccess <= ttl);
    }

    clear(): void {
        this.heap = [];
        this.stats = {additions: 0, removals: 0, hits: 0, misses: 0};
    }

    toArray(): T[] {
        return this.heap.map(h => h.item);
    }

    pruneTo(maxSize: number): void {
        this.heap = this.heap.slice(0, maxSize);
    }

    peek(): T | undefined {
        return this.heap[0]?.item;
    }

    remove(item: T): boolean {
        const idx = this.heap.findIndex(h => h.item === item);
        if (idx >= 0) {
            this.heap.splice(idx, 1);
            return true;
        }
        return false;
    }

    * entries(): Generator<[T, number]> {
        for (const {item, priority} of this.heap) yield [item, priority];
    }

    private getMinEntry(): BagItem<T> | undefined {
        return this.heap[this.heap.length - 1];
    }

    private handleOverflow(priority: number): boolean {
        const minP = this.getMinEntry()?.priority ?? 0;
        if (priority <= minP) return false;
        this.overflowBehavior === 'merge' ? this.heap.pop() : this.heap.splice(this.heap.length - 1, 1);
        return true;
    }
}