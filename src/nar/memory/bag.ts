import {BaseBag} from './BaseBag.js';

export interface BagItem<T> {
    item: T;
    priority: number;
    lastAccess: number;
    createdAt: number;
}

export type SamplingObjective =
    | { type: 'priority' }
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

const SAMPLE_FN: Record<string, (heap: BagItem<unknown>[], obj: Record<string, unknown>, bag?: any) => unknown> = {
    priority: (h, o, bag) => {
        if (h.length === 0) return undefined;
        let total = bag?._totalPriority ?? 0;
        if (total <= 0) {
            total = 0;
            for (let i = 0; i < h.length; i++) {
                total += h[i]!.priority;
            }
            if (bag) bag._totalPriority = total;
        }
        if (total <= 0) return h[h.length - 1]?.item;

        let r = Math.random() * total;
        // iterate backwards (highest priority first for faster exit usually)
        for (let i = h.length - 1; i >= 0; i--) {
            const e = h[i];
            if (e) {
                r -= e.priority;
                if (r <= 0) return e.item;
            }
        }
        return h[0]?.item;
    },
    recency: (h, o) => {
        const cutoff = Date.now() - (o.windowMs as number);
        let best = undefined;
        let bestLastAccess = -1;
        for (let i = 0; i < h.length; i++) {
            const e = h[i];
            if (e && e.lastAccess >= cutoff && e.lastAccess > bestLastAccess) {
                best = e.item;
                bestLastAccess = e.lastAccess;
            }
        }
        return best;
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




export class Bag<T> extends BaseBag<{ priority: number; createdAt: number; lastAccessedAt: number }> {
    private heap: BagItem<T>[] = [];
    public _totalPriority = 0;

    constructor(capacity: number, options?: {
        overflowBehavior?: 'reject' | 'replace-lowest' | 'merge';
        onOverflow?: (item: T, priority: number, bag: Bag<T>) => void
    }) {
        super({
            capacity,
            overflowBehavior: options?.overflowBehavior
        });
    }

    static deserialize<T>(state: BoundedBagState<T>): Bag<T> {
        const bag = new Bag<T>(state.capacity, {overflowBehavior: state.overflowBehavior});
        for (const {item, priority, lastAccess, createdAt} of state.items) {
            bag.heap.push({item, priority, lastAccess, createdAt});
        }
        bag.stats = {...state.stats};
        return bag;
    }

    add(item: T, priority: number): boolean {
        if (this.capacity === 0) {
            this.trackMiss();
            return false;
        }

        const entry = {item, priority, lastAccess: Date.now(), createdAt: Date.now()};

        if (this.heap.length >= this.capacity) {
            this.trackMiss();
            if (!this.shouldOverflow(priority)) return false;
        } else {
            this.trackAdd();
        }

        const idx = this.heap.findIndex(h => h.priority < priority);
        idx === -1 ? this.heap.push(entry) : this.heap.splice(idx, 0, entry);
        this._totalPriority += priority;
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
                this.trackRemoval();
                this._totalPriority -= entry.priority;
                return false;
            }
            return true;
        });
        return removed;
    }

    override getStatistics(): BagStatistics {
        return super.getStatistics() as BagStatistics;
    }

    serialize(): BoundedBagState<T> {
        return {
            items: this.heap.map(({item, priority, lastAccess, createdAt}) => ({
                item,
                priority,
                lastAccess,
                createdAt
            })),
            capacity: this.capacityValue,
            overflowBehavior: this.overflowBehavior,
            stats: {...this.stats}
        };
    }

    sample(objective: SamplingObjective): T | undefined {
        const strategy = SAMPLE_FN[objective.type];
        if (!strategy) return undefined;
        const result = strategy(this.heap, objective, this);
        this.trackHit();
        if (!result) this.trackMiss();
        return result as T | undefined;
    }

    override consolidate(currentTime: number, ttl: number): void {
        super.consolidate(currentTime, ttl);
    }

    clear(): void {
        this.heap = [];
        this._totalPriority = 0;
        this.clearStats();
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

  getItems(): T[] {
    return this.heap.map(h => h.item);
  }

    remove(item: T): boolean {
        const idx = this.heap.findIndex(h => h.item === item);
        if (idx >= 0) {
            const e = this.heap[idx];
            if (e) this._totalPriority -= e.priority;
            this.heap.splice(idx, 1);
            this.trackRemoval();
            return true;
        }
        return false;
    }

    * entries(): Generator<[T, number]> {
        for (const {item, priority} of this.heap) yield [item, priority];
    }

    protected override itemsCount(): number {
        return this.heap.length;
    }

    protected override getPriorities(): number[] {
        return this.heap.map(h => h.priority);
    }

    protected override getAges(): number[] {
        return this.heap.map(h => Date.now() - h.createdAt);
    }

    protected override getCreatedTimes(): number[] {
        return this.heap.map(h => h.createdAt);
    }

    protected override selectVictim(): string | undefined {
        return this.getMinEntryId();
    }

    protected override removeById(id: string): boolean {
        const idx = this.heap.findIndex(h => this.getItemId(h) === id);
        if (idx >= 0) {
            const e = this.heap[idx];
            if (e) this._totalPriority -= e.priority;
            this.heap.splice(idx, 1);
            return true;
        }
        return false;
    }

    protected override updateAccess(id: string): void {
        const idx = this.heap.findIndex(h => this.getItemId(h) === id);
        if (idx >= 0) {
            this.heap[idx]!.lastAccess = Date.now();
        }
    }

    protected override getIds(): string[] {
        return this.heap.map(h => String(h.item));
    }

    private shouldOverflow(priority: number): boolean {
        const minEntry = this.getMinEntry();
        if (!minEntry) return false;

        const minP = minEntry.priority;
        if (priority <= minP) {
            this.trackMiss();
            return false;
        }

        this.removeById(String(minEntry.item));
        this.onOverflow?.(priority, this);
        return true;
    }

    private getItemId(entry: BagItem<T>): string {
        return String(entry.item);
    }

    private getMinEntryId(): string | undefined {
        return this.heap.length > 0 ? String(this.heap[this.heap.length - 1]?.item) : undefined;
    }

    private getMinEntry(): BagItem<T> | undefined {
        return this.heap[this.heap.length - 1];
    }
}
