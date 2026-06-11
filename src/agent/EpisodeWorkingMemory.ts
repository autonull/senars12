export interface EpisodeSlot {
    name: string;
    values: string[];
    expiresAt: number;
    updatedAt: number;
}

export interface EpisodeWorkingMemoryOptions {
    defaultTTLMs?: number;
    maxValuesPerSlot?: number;
    clock?: () => number;
}

const DEFAULT_TTL = 5 * 60_000;
const DEFAULT_MAX_VALUES = 64;

export class EpisodeWorkingMemory {
    private readonly slots = new Map<string, EpisodeSlot>();
    private readonly defaultTTL: number;
    private readonly maxValues: number;
    private readonly now: () => number;

    constructor(opts: EpisodeWorkingMemoryOptions = {}) {
        this.defaultTTL = opts.defaultTTLMs ?? DEFAULT_TTL;
        this.maxValues = opts.maxValuesPerSlot ?? DEFAULT_MAX_VALUES;
        this.now = opts.clock ?? Date.now;
    }

    set(name: string, value: unknown, ttlMs?: number): void {
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        this.slots.set(name, {
            name,
            values: [text],
            expiresAt: this.now() + (ttlMs ?? this.defaultTTL),
            updatedAt: this.now(),
        });
    }

    append(name: string, value: string, ttlMs?: number, limit?: number): void {
        const cap = limit ?? this.maxValues;
        const existing = this.slots.get(name);
        const nextValues = existing ? [...existing.values, value] : [value];
        const deduped = Array.from(new Set(nextValues));
        const trimmed = deduped.length > cap ? deduped.slice(-cap) : deduped;
        this.slots.set(name, {
            name,
            values: trimmed,
            expiresAt: this.now() + (ttlMs ?? this.defaultTTL),
            updatedAt: this.now(),
        });
    }

    remove(name: string, value: string): boolean {
        const slot = this.slots.get(name);
        if (!slot) return false;
        const idx = slot.values.indexOf(value);
        if (idx < 0) return false;
        slot.values.splice(idx, 1);
        slot.updatedAt = this.now();
        if (slot.values.length === 0) this.slots.delete(name);
        return true;
    }

    touch(name: string, ttlMs?: number): boolean {
        const slot = this.slots.get(name);
        if (!slot) return false;
        if (slot.expiresAt < this.now()) {
            this.slots.delete(name);
            return false;
        }
        slot.updatedAt = this.now();
        slot.expiresAt = this.now() + (ttlMs ?? this.defaultTTL);
        return true;
    }

    clear(name: string): void {
        this.slots.delete(name);
    }

    get(name: string): unknown {
        const slot = this.slots.get(name);
        if (!slot) return undefined;
        if (slot.expiresAt < this.now()) {
            this.slots.delete(name);
            return undefined;
        }
        return slot.values.length === 1 ? slot.values[0] : slot.values.slice();
    }

    snapshot(): Readonly<Record<string, unknown>> {
        const out: Record<string, unknown> = {};
        for (const [name, slot] of this.slots) {
            if (slot.expiresAt < this.now()) {
                this.slots.delete(name);
                continue;
            }
            out[name] = slot.values.length === 1 ? slot.values[0] : slot.values.slice();
        }
        return out;
    }

    keys(): string[] {
        return Array.from(this.slots.keys());
    }

    has(name: string): boolean {
        const slot = this.slots.get(name);
        if (!slot) return false;
        if (slot.expiresAt < this.now()) {
            this.slots.delete(name);
            return false;
        }
        return true;
    }

    prune(): number {
        let removed = 0;
        for (const [name, slot] of this.slots) {
            if (slot.expiresAt < this.now()) {
                this.slots.delete(name);
                removed++;
            }
        }
        return removed;
    }
}
