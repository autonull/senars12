import type {Concept} from './concept.js';
import type {Term} from '../terms';
import {extractSymbols, jaccardSimilarity, termsEqual} from '../terms';
import {TermMap} from '../terms';
import {addToSet} from '../utils/collections.js';
import {THRESHOLDS} from '../constants.js';

export interface MemoryIndexConfig {
    enableAtomicIndex: boolean;
    enableTemporalIndex: boolean;
    enableActivationIndex: boolean;
    enableInverseIndex?: boolean;
    enableSimilarityIndex?: boolean;
}

export interface IndexEntry {
    concept: Concept;
    timestamp: number;
    activation: number;
}

export interface InverseIndexEntry {
    concepts: Set<Concept>;
    subtermIndices: TermMap<Set<Concept>>;
}

export interface SimilarityCluster {
    term: Term;
    concepts: Concept[];
    representative: Concept;
}

export class MemoryIndex {
    private readonly atomicIndex: Map<string, Set<Concept>>;
    private readonly temporalIndex: Map<number, Set<Concept>>;
    private activationIndex: Map<Concept, number>;
    private inverseIndex: TermMap<InverseIndexEntry>;
    private readonly similarityIndex: TermMap<SimilarityCluster>;
    private config: Required<MemoryIndexConfig>;
    private readonly temporalResolution = THRESHOLDS.TEMPORAL_RESOLUTION;

    constructor(
        config: MemoryIndexConfig = {
            enableAtomicIndex: true,
            enableTemporalIndex: true,
            enableActivationIndex: true,
            enableInverseIndex: true,
            enableSimilarityIndex: true,
        }
    ) {
        this.config = {...config} as Required<MemoryIndexConfig>;
        this.atomicIndex = new Map();
        this.temporalIndex = new Map();
        this.activationIndex = new Map();
        this.inverseIndex = new TermMap();
        this.similarityIndex = new TermMap();
    }

    get stats(): {
        atomic: number;
        temporal: number;
        activation: number;
        inverse: number;
        similarity: number;
    } {
        return {
            atomic: this.atomicIndex.size,
            temporal: this.temporalIndex.size,
            activation: this.activationIndex.size,
            inverse: this.inverseIndex.size,
            similarity: this.similarityIndex.size,
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

        if (this.config.enableInverseIndex) {
            this.indexByInverse(concept);
        }

        if (this.config.enableSimilarityIndex) {
            this.indexBySimilarity(concept);
        }
    }

    getByAtomic(symbol: string): Concept[] {
        const set = this.atomicIndex.get(symbol);
        return set ? Array.from(set) : [];
    }

    getByTemporal(timeRange: [number, number]): Concept[] {
        const [start, end] = timeRange;
        const results: Concept[] = [];
        const startKey = Math.floor(start / this.temporalResolution);
        const endKey = Math.floor(end / this.temporalResolution);

        for (let key = startKey; key <= endKey; key++) {
            const set = this.temporalIndex.get(key);
            if (set) {
                for (const concept of set) {
                    results.push(concept);
                }
            }
        }

        const unique = new Set(results);
        return Array.from(unique);
    }

    getByInverse(term: Term): Concept[] {
        const entry = this.inverseIndex.get(term);
        if (!entry) return [];
        return Array.from(entry.concepts);
    }

    getBySubterm(term: Term): Concept[] {
        const entry = this.inverseIndex.get(term);
        if (!entry) return [];
        const results = new Set(entry.concepts);
        entry.subtermIndices.get(term)?.forEach(c => results.add(c));
        return Array.from(results);
    }

    getBySimilarity(term: Term, threshold = 0.5): Concept[] {
        const cluster = this.similarityIndex.get(term);
        if (!cluster) return [];

        return cluster.concepts.filter(c => c.priority >= threshold);
    }

    findSimilarConcepts(term: Term, limit = 10): Concept[] {
        if (!this.config.enableSimilarityIndex) return [];

        const cluster = this.similarityIndex.get(term);
        if (cluster && cluster.concepts.length > 0) {
            return cluster.concepts.slice(0, limit);
        }

        let bestCluster: SimilarityCluster | undefined;
        let bestSimilarity = 0;

        for (const [, cluster] of this.similarityIndex.items()) {
            const similarity = this.calculateClusterSimilarity(cluster, term);
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestCluster = cluster;
            }
        }

        if (bestCluster) {
            return bestCluster.concepts.slice(0, limit);
        }

        return [];
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

        if (this.config.enableInverseIndex) {
            for (const entry of this.inverseIndex.values()) {
                entry.concepts.delete(concept);
                for (const [, subtermSet] of entry.subtermIndices.items()) {
                    subtermSet.delete(concept);
                }
            }
        }

        if (this.config.enableSimilarityIndex) {
            for (const cluster of this.similarityIndex.values()) {
                cluster.concepts = cluster.concepts.filter(c => c !== concept);
            }
        }
    }

    clear(): void {
        this.atomicIndex.clear();
        this.temporalIndex.clear();
        this.activationIndex.clear();
        this.inverseIndex.clear();
        this.similarityIndex.clear();
    }

    private indexByAtomic(concept: Concept): void {
        const term = concept.term;
        const key = term.kind === 'atom' ? term.symbol : `${term.kind}-${term.args?.map(a => a.kind === 'atom' ? a.symbol : String(a.kind)).join(',')}`;

        addToSet(this.atomicIndex, key, concept);
    }

    private indexByTemporal(concept: Concept, timestamp: number): void {
        const timeKey = Math.floor(timestamp / this.temporalResolution);

        addToSet(this.temporalIndex, timeKey, concept);
    }

    private indexByInverse(concept: Concept): void {
        const term = concept.term;

        let entry = this.inverseIndex.get(term);
        if (!entry) {
            entry = {
                concepts: new Set(),
                subtermIndices: new TermMap(),
            };
            this.inverseIndex.set(term, entry);
        }
        entry.concepts.add(concept);

        if ('args' in term && Array.isArray(term.args)) {
            this.indexSubterms(term.args as readonly any[], concept, entry);
        }
    }

    private indexSubterms(
        args: readonly unknown[],
        concept: Concept,
        entry: InverseIndexEntry
    ): void {
        for (const arg of args) {
            if (typeof arg === 'object' && arg !== null) {
                const argTerm = arg as Term;
                if (argTerm) {
                    const existingSet = entry.subtermIndices.get(argTerm) || new Set();
                    entry.subtermIndices.set(argTerm, existingSet);
                    entry.subtermIndices.get(argTerm)?.add(concept);

                    const argArgs = (arg as { args?: readonly unknown[] }).args;
                    if (argArgs && Array.isArray(argArgs)) {
                        this.indexSubterms(argArgs, concept, entry);
                    }
                }
            }
        }
    }

    private indexBySimilarity(concept: Concept): void {
        const term = concept.term;

        let cluster = this.similarityIndex.get(term);
        if (!cluster) {
            cluster = {
                term,
                concepts: [],
                representative: concept,
            };
            this.similarityIndex.set(term, cluster);
        }

        if (!cluster.concepts.includes(concept)) {
            cluster.concepts.push(concept);
            cluster.concepts.sort((a, b) => b.priority - a.priority);

            if (cluster.concepts.length > 1 && cluster.concepts[0] !== cluster.representative) {
                const first = cluster.concepts[0];
                if (first) cluster.representative = first;
            }
        }
    }

    private calculateClusterSimilarity(cluster: SimilarityCluster, term: Term): number {
        if (termsEqual(cluster.representative.term, term)) return 1;
        return jaccardSimilarity(extractSymbols(cluster.representative.term), extractSymbols(term));
    }
}
