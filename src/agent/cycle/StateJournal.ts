import type {State, Focus} from './State.js';
import type {Turn} from './Turn.js';

export interface JournalEntry {
    readonly version: number;
    readonly state: State;
    readonly turns: readonly Turn[];
    readonly focus: Focus | null;
    readonly recordedAt: number;
}

export interface StateJournalOptions {
    readonly maxEntries?: number;
    readonly now?: () => number;
}

export class StateJournal {
    private readonly entries: JournalEntry[] = [];
    private readonly maxEntries: number;
    private readonly now: () => number;

    constructor(opts: StateJournalOptions = {}) {
        this.maxEntries = opts.maxEntries ?? 1000;
        this.now = opts.now ?? (() => Date.now());
    }

    record(state: State, turns: readonly Turn[], focus: Focus | null = state.attention, recordedAt?: number): JournalEntry {
        const entry: JournalEntry = {
            version: state.version,
            state,
            turns,
            focus,
            recordedAt: recordedAt ?? this.now(),
        };
        this.entries.push(entry);
        if (this.entries.length > this.maxEntries) {
            this.entries.splice(0, this.entries.length - this.maxEntries);
        }
        return entry;
    }

    get(version: number): JournalEntry | null {
        return this.entries.find(e => e.version === version) ?? null;
    }

    latest(): JournalEntry | null {
        return this.entries.at(-1) ?? null;
    }

    last(n: number): readonly JournalEntry[] {
        if (n <= 0 || this.entries.length === 0) return [];
        return this.entries.slice(-n);
    }

    all(): readonly JournalEntry[] {
        return [...this.entries];
    }

    size(): number {
        return this.entries.length;
    }

    clear(): void {
        this.entries.length = 0;
    }

    versions(): readonly number[] {
        return this.entries.map(e => e.version);
    }
}
