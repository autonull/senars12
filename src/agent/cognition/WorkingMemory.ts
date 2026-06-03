import {EventBus} from '../../nar/types/events.js';

export type SlotName =
    | 'focus'
    | 'goal'
    | 'hypothesis'
    | 'evidence'
    | 'open_questions'
    | 'recent_derivations'
    | 'prior_insights';

export type SlotValue = string | number | boolean | string[] | number[] | null;

export type SlotMap = Record<SlotName, SlotValue | undefined>;

export const DEFAULT_TTLS: Record<SlotName, number> = {
    focus: 60 * 60 * 1000,
    goal: 60 * 60 * 1000,
    hypothesis: 5 * 60 * 1000,
    evidence: 5 * 60 * 1000,
    open_questions: Number.POSITIVE_INFINITY,
    recent_derivations: 5 * 60 * 1000,
    prior_insights: 5 * 60 * 1000,
};

interface SlotEntry {
    value: SlotValue;
    expiresAt: number;
}

export interface WorkingMemoryEventMap {
    'wm:set': {name: SlotName; value: SlotValue};
    'wm:clear': {name: SlotName};
    'wm:expired': {name: SlotName};
}

export class WorkingMemory {
    private readonly slots = new Map<SlotName, SlotEntry>();
    private readonly eventBus: EventBus;
    private readonly defaultTtls: Record<SlotName, number>;
    private readonly now: () => number;

    constructor(opts: {eventBus?: EventBus; defaultTtls?: Partial<Record<SlotName, number>>; now?: () => number} = {}) {
        this.eventBus = opts.eventBus ?? new EventBus();
        this.defaultTtls = {...DEFAULT_TTLS, ...(opts.defaultTtls ?? {})};
        this.now = opts.now ?? (() => Date.now());
    }

    get<T extends SlotValue = SlotValue>(name: SlotName): T | undefined {
        const entry = this.slots.get(name);
        if (!entry) return undefined;
        if (entry.expiresAt <= this.now()) {
            this.slots.delete(name);
            this.eventBus.emit('wm:expired', {name});
            return undefined;
        }
        return entry.value as T;
    }

    set(name: SlotName, value: SlotValue, ttlMs?: number): void {
        const ttl = ttlMs ?? this.defaultTtls[name] ?? DEFAULT_TTLS[name] ?? 5 * 60 * 1000;
        const expiresAt = ttl === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : this.now() + ttl;
        this.slots.set(name, {value, expiresAt});
        this.eventBus.emit('wm:set', {name, value});
    }

    append(name: SlotName, value: string, ttlMs?: number, limit = 64): void {
        const current = this.get<string[]>(name) ?? [];
        if (current.includes(value)) return;
        const next = [...current, value].slice(-limit);
        this.set(name, next, ttlMs);
    }

    remove(name: SlotName, value: string): void {
        const current = this.get<string[]>(name);
        if (!current) return;
        const next = current.filter(v => v !== value);
        if (next.length === 0) this.clear(name);
        else this.set(name, next);
    }

    clear(name: SlotName): void {
        this.slots.delete(name);
        this.eventBus.emit('wm:clear', {name});
    }

    clearAll(): void {
        for (const k of [...this.slots.keys()]) this.clear(k);
    }

    has(name: SlotName): boolean {
        return this.get(name) !== undefined;
    }

    keys(): SlotName[] {
        this.prune();
        return [...this.slots.keys()];
    }

    snapshot(): Readonly<Record<string, SlotValue | undefined>> {
        this.prune();
        const out: Record<string, SlotValue | undefined> = {};
        for (const [k, entry] of this.slots.entries()) out[k] = entry.value;
        return out;
    }

    toJSON(): {slots: Array<{name: SlotName; value: SlotValue; expiresAt: number}>; ts: number} {
        this.prune();
        return {
            ts: this.now(),
            slots: [...this.slots.entries()].map(([name, entry]) => ({
                name,
                value: entry.value,
                // JSON.stringify converts Number.POSITIVE_INFINITY to null, which
                // would make fromJSON drop the slot. Encode infinity as a
                // large-but-finite number that round-trips through JSON.
                expiresAt: entry.expiresAt === Number.POSITIVE_INFINITY ? Number.MAX_SAFE_INTEGER : entry.expiresAt,
            })),
        };
    }

    fromJSON(data: {slots?: Array<{name: SlotName; value: SlotValue; expiresAt: number}>} | null | undefined): void {
        if (!data?.slots) return;
        this.slots.clear();
        for (const s of data.slots) {
            const expiresAt = s.expiresAt === Number.MAX_SAFE_INTEGER ? Number.POSITIVE_INFINITY : s.expiresAt;
            if (typeof expiresAt === 'number' && expiresAt <= this.now()) continue;
            this.slots.set(s.name, {value: s.value, expiresAt});
        }
    }

    fork(): WorkingMemory {
        const child = new WorkingMemory({eventBus: this.eventBus, defaultTtls: this.defaultTtls, now: this.now});
        child.fromJSON(this.toJSON());
        return child;
    }

    getEventBus(): EventBus {
        return this.eventBus;
    }

    private prune(): void {
        const t = this.now();
        for (const [k, entry] of [...this.slots.entries()]) {
            if (entry.expiresAt <= t) {
                this.slots.delete(k);
                this.eventBus.emit('wm:expired', {name: k});
            }
        }
    }
}
