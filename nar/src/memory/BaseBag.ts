import type {BagStatistics} from './bag.js';

export interface BagMetadata {
    priority: number;
    createdAt: number;
    lastAccessedAt: number;
}

export interface BagStats {
    additions: number;
    removals: number;
    hits: number;
    misses: number;
}

export interface BagOptions {
    capacity: number;
    overflowBehavior?: 'reject' | 'replace-lowest' | 'merge';
    onOverflow?: (priority: number, bag: BaseBag<any>) => void;
}

const statsFromValues = (values: number[]) => {
    if (values.length === 0) return {min: 0, max: 0, avg: 0, median: 0};
    const sorted = [...values].sort((a, b) => a - b);
    return {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    };
};

const AGE_BUCKETS = [
    {min: 0, max: 60_000, count: 0},
    {min: 60_000, max: 300_000, count: 0},
    {min: 300_000, max: 900_000, count: 0},
    {min: 900_000, max: Number.POSITIVE_INFINITY, count: 0},
] as const;

export abstract class BaseBag<T extends BagMetadata> {
    protected readonly capacity: number;
    protected overflowBehavior: 'reject' | 'replace-lowest' | 'merge';
    protected stats: BagStats = {additions: 0, removals: 0, hits: 0, misses: 0};
    protected onOverflow?: (priority: number, bag: BaseBag<T>) => void;

    protected constructor(options: BagOptions) {
        this.capacity = options.capacity;
        this.overflowBehavior = options.overflowBehavior ?? 'reject';
        this.onOverflow = options.onOverflow;
    }

    get size(): number {
        return this.itemsCount();
    }

    get capacityValue(): number {
        return this.capacity;
    }

    get statistics(): BagStatistics {
        return this.getStatistics();
    }

    consolidate(currentTime: number, ttl: number): void {
        const toRemove: string[] = [];
        const createdAts = this.getCreatedTimes();
        const ids = this.getIds();

        for (let i = 0; i < Math.min(createdAts.length, ids.length); i++) {
            const createdAt = createdAts[i];
            if (createdAt != null && currentTime - createdAt > ttl) {
                const id = ids[i];
                if (id != null) {
                    toRemove.push(id);
                }
            }
        }

        for (const id of toRemove) {
            this.removeById(id);
            this.trackRemoval();
        }
    }

    clearStats(): void {
        this.stats = {additions: 0, removals: 0, hits: 0, misses: 0};
    }

    protected abstract itemsCount(): number;

    protected abstract getPriorities(): number[];

    protected abstract getAges(): number[];

    protected abstract getCreatedTimes(): number[];

    protected abstract selectVictim(): string | undefined;

    protected abstract removeById(id: string): boolean;

    protected abstract updateAccess(id: string): void;

    protected trackAdd(): void {
        this.stats.additions++;
    }

    protected trackRemoval(): void {
        this.stats.removals++;
    }

    protected trackHit(): void {
        this.stats.hits++;
    }

    protected trackMiss(): void {
        this.stats.misses++;
    }

    protected isOverflow(): boolean {
        return this.itemsCount() >= this.capacity;
    }

    protected handleOverflow(priority: number): boolean {
        const victimId = this.selectVictim();
        if (!victimId) {
            this.trackMiss();
            return false;
        }

        this.removeById(victimId);
        this.onOverflow?.(priority, this);
        return true;
    }

    protected getStatistics(): BagStatistics {
        const priorities = this.getPriorities();
        const ages = this.getAges();
        const buckets = AGE_BUCKETS.map((b) => ({...b}));

        for (const age of ages) {
            const bucket = buckets.find((b) => age >= b.min && age < b.max);
            if (bucket) bucket.count++;
        }

        return {
            size: this.itemsCount(),
            capacity: this.capacity,
            utilization: this.itemsCount() / this.capacity,
            priorityDistribution: statsFromValues(priorities),
            ageHistogram: {buckets},
            throughput: {...this.stats},
        };
    }

    protected getIds(): string[] {
        return [];
    }
}
