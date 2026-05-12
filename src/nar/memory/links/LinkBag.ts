import type {LinkEntry} from './types.js';

export class LinkBag {
    private readonly items: Map<string, LinkEntry>;
    private priorityIndex: Map<string, number>;
    private accessTimes: Map<string, number>;
    private readonly onRemoved?: (entry: LinkEntry) => void;

    constructor(
        private readonly capacity: number,
        private readonly forgetPolicy: 'priority' | 'lru' | 'fifo' | 'random',
        onRemoved?: (entry: LinkEntry) => void
    ) {
        this.items = new Map();
        this.priorityIndex = new Map();
        this.accessTimes = new Map();
        this.onRemoved = onRemoved;
    }

    add(entry: LinkEntry): boolean {
        if (this.items.has(entry.id)) {
            return false;
        }

        while (this.size() >= this.capacity && this.size() > 0) {
            const victim = this.peekLowest();
            if (!victim) break;
            this.remove(victim.id);
        }

        if (this.size() >= this.capacity) {
            return false;
        }

        this.items.set(entry.id, entry);
        this.priorityIndex.set(entry.id, entry.priority);
        this.accessTimes.set(entry.id, entry.lastAccessedAt);
        return true;
    }

    remove(id: string): boolean {
        const entry = this.items.get(id);
        if (!entry) return false;

        if (this.onRemoved) {
            this.onRemoved(entry);
        }

        this.items.delete(id);
        this.priorityIndex.delete(id);
        this.accessTimes.delete(id);
        return true;
    }

    get(id: string): LinkEntry | undefined {
        const entry = this.items.get(id);
        if (entry) {
            entry.lastAccessedAt = Date.now();
            this.accessTimes.set(id, entry.lastAccessedAt);
        }
        return entry;
    }

    peekLowest(): LinkEntry | undefined {
        if (this.items.size === 0) return undefined;

        let lowest: LinkEntry | undefined;
        let lowestPriority = Infinity;
        let oldestAccess = Infinity;

        for (const entry of this.items.values()) {
            if (this.forgetPolicy === 'lru' || this.forgetPolicy === 'fifo') {
                const accessTime = this.accessTimes.get(entry.id) ?? entry.lastAccessedAt;
                if (accessTime < oldestAccess) {
                    oldestAccess = accessTime;
                    lowest = entry;
                }
            } else {
                if (entry.priority < lowestPriority || (entry.priority === lowestPriority && entry.createdAt < oldestAccess)) {
                    lowestPriority = entry.priority;
                    oldestAccess = entry.createdAt;
                    lowest = entry;
                }
            }
        }

        if (this.forgetPolicy === 'random') {
            const entries = Array.from(this.items.values());
            return entries[Math.floor(Math.random() * entries.length)];
        }

        return lowest;
    }

    size(): number {
        return this.items.size;
    }

    applyDecay(decayRate: number): void {
        const toRemove: string[] = [];
        const minPriority = 0.01;

        for (const [id, entry] of this.items) {
            entry.priority = Math.max(0, entry.priority * (1 - decayRate));
            this.priorityIndex.set(id, entry.priority);

            if (entry.priority < minPriority) {
                toRemove.push(id);
            }
        }

        for (const id of toRemove) {
            this.remove(id);
        }
    }

    clear(): void {
        this.items.clear();
        this.priorityIndex.clear();
        this.accessTimes.clear();
    }

    * entries(): IterableIterator<LinkEntry> {
        for (const entry of this.items.values()) {
            yield entry;
        }
    }
}
