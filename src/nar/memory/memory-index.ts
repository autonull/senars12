import type {Concept} from './concept.js';

export interface MemoryIndexConfig {
    enableAtomicIndex: boolean;
    enableTemporalIndex: boolean;
    enableActivationIndex: boolean;
}

export interface IndexEntry {
    concept: Concept;
    timestamp: number;
    activation: number;
}

export class MemoryIndex {
    private atomicIndex: Map<string, Set<Concept>>;
    private temporalIndex: Map<number, Set<Concept>>;
    private activationIndex: Map<Concept, number>;
    private config: MemoryIndexConfig;

    constructor(config: MemoryIndexConfig = {
        enableAtomicIndex: true,
        enableTemporalIndex: true,
        enableActivationIndex: true
    }) {
        this.config = config;
        this.atomicIndex = new Map();
        this.temporalIndex = new Map();
        this.activationIndex = new Map();
    }

    get stats(): { atomic: number; temporal: number; activation: number } {
        return {
            atomic: this.atomicIndex.size,
            temporal: this.temporalIndex.size,
            activation: this.activationIndex.size
        };
    }

    index(concept: Concept, timestamp: number = Date.now()): void {
        if (this.config.enableAtomicIndex) {
            this.indexByAtomic(concept);
        }

        if (this.config.enableTemporalIndex) {
            this.indexByTemporal(concept, timestamp);
        }

        if (this.config.enableActivationIndex) {
            this.activationIndex.set(concept, concept.priority);
        }
    }

    getByAtomic(symbol: string): Concept[] {
        const set = this.atomicIndex.get(symbol);
        return set ? Array.from(set) : [];
    }

    getByTemporal(timeRange: [number, number]): Concept[] {
        const [start, end] = timeRange;
        const results: Concept[] = [];

        for (let t = start; t <= end; t++) {
            const set = this.temporalIndex.get(Math.floor(t / 1000));
            if (set) {
                results.push(...Array.from(set));
            }
        }

        return results;
    }

    getActivation(concept: Concept): number {
        return this.activationIndex.get(concept) ?? 0;
    }

    updateActivation(concept: Concept, activation: number): void {
        this.activationIndex.set(concept, activation);
    }

    remove(concept: Concept): void {
        for (const set of this.atomicIndex.values()) {
            set.delete(concept);
        }

        for (const set of this.temporalIndex.values()) {
            set.delete(concept);
        }

        this.activationIndex.delete(concept);
    }

    clear(): void {
        this.atomicIndex.clear();
        this.temporalIndex.clear();
        this.activationIndex.clear();
    }

    private indexByAtomic(concept: Concept): void {
        const term = concept.term;
        const key = term.kind === 'atom' ? term.symbol : `${term.kind}-${term.hash}`;

        let set = this.atomicIndex.get(key);
        if (!set) {
            set = new Set();
            this.atomicIndex.set(key, set);
        }
        set.add(concept);
    }

    private indexByTemporal(concept: Concept, timestamp: number): void {
        const timeKey = Math.floor(timestamp / 1000);

        let set = this.temporalIndex.get(timeKey);
        if (!set) {
            set = new Set();
            this.temporalIndex.set(timeKey, set);
        }
        set.add(concept);
    }
}


