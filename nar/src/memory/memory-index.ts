import { addToSet, getOrInsert, insertByScoreDesc } from '@senars/util';

import type { Term } from '../terms';
import { isAtomic, TermMap, termKey } from '../terms';
import type { Concept } from './concept.js';
import { selectSimilar } from './similarity.js';

const getOrInsertTermSet = (map: TermMap<Set<Concept>>, term: Term): Set<Concept> =>
  getOrInsert(map, term, () => new Set<Concept>());

const getOrInsertCluster = (map: TermMap<SimilarityCluster>, term: Term, seed: Concept) =>
  getOrInsert(map, term, (): SimilarityCluster => ({ term, concepts: [], representative: seed }));

const getOrInsertInverse = (map: TermMap<InverseIndexEntry>, term: Term) =>
  getOrInsert(map, term, (): InverseIndexEntry => ({
    term,
    concepts: new Set<Concept>(),
    subtermIndices: new TermMap<Set<Concept>>(),
  }));

/** Every family defaults on; a caller opts out of the ones it does not maintain. */
export interface MemoryIndexConfig {
  enableAtomicIndex?: boolean;
  enableTemporalIndex?: boolean;
  enableActivationIndex?: boolean;
  enableInverseIndex?: boolean;
  enableSimilarityIndex?: boolean;
}

const DEFAULT_INDEX_CONFIG: Required<MemoryIndexConfig> = Object.freeze({
  enableAtomicIndex: true,
  enableTemporalIndex: true,
  enableActivationIndex: true,
  enableInverseIndex: true,
  enableSimilarityIndex: true,
});

export interface IndexEntry {
  concept: Concept;
  timestamp: number;
  activation: number;
}

export interface InverseIndexEntry {
  term: Term;
  concepts: Set<Concept>;
  subtermIndices: TermMap<Set<Concept>>;
}

export interface SimilarityCluster {
  term: Term;
  concepts: Concept[];
  representative: Concept;
}

/** The exact index keys one concept was written under, so removal touches only
 *  those buckets instead of scanning every index family. */
interface ConceptFootprint {
  atomicKey?: string;
  temporalKey?: number;
  inverseEntry?: InverseIndexEntry;
  subterms: Term[];
  clusters: SimilarityCluster[];
}

export class MemoryIndex {
  private readonly atomicIndex: Map<string, Set<Concept>>;
  private readonly temporalIndex: Map<number, Set<Concept>>;
  private activationIndex: Map<Concept, number>;
  private inverseIndex: TermMap<InverseIndexEntry>;
  private readonly similarityIndex: TermMap<SimilarityCluster>;
  private config: Required<MemoryIndexConfig>;
  private readonly footprints = new Map<Concept, ConceptFootprint>();
  private readonly temporalResolution = 1000;

  constructor(config: MemoryIndexConfig = {}) {
    this.config = { ...DEFAULT_INDEX_CONFIG, ...config };
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
    if (this.footprints.has(concept)) return;
    const footprint: ConceptFootprint = { subterms: [], clusters: [] };
    this.footprints.set(concept, footprint);

    if (this.config.enableAtomicIndex) {
      footprint.atomicKey = this.atomicKey(concept.term);
      addToSet(this.atomicIndex, footprint.atomicKey, concept);
    }

    if (this.config.enableTemporalIndex) {
      footprint.temporalKey = Math.floor(timestamp / this.temporalResolution);
      addToSet(this.temporalIndex, footprint.temporalKey, concept);
    }

    if (this.config.enableActivationIndex) {
      this.activationIndex.set(concept, concept.priority);
    }

    if (this.config.enableInverseIndex) {
      this.indexByInverse(concept, footprint);
    }

    if (this.config.enableSimilarityIndex) {
      this.indexBySimilarity(concept, footprint);
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
    entry.subtermIndices.get(term)?.forEach((c) => {
      results.add(c);
    });
    return Array.from(results);
  }

  /** Every concept the similarity families hold, as one candidate stream. */
  *indexedConcepts(): Generator<Concept> {
    for (const cluster of this.similarityIndex.values()) yield* cluster.concepts;
  }

  findSimilarConcepts(term: Term, limit = 10): Concept[] {
    return this.config.enableSimilarityIndex
      ? selectSimilar(this.indexedConcepts(), term, limit)
      : [];
  }

  getActivation(concept: Concept): number {
    return this.activationIndex.get(concept) ?? 0;
  }

  updateActivation(concept: Concept, activation: number): void {
    this.activationIndex.set(concept, activation);
  }

  remove(concept: Concept): void {
    const footprint = this.footprints.get(concept);
    this.footprints.delete(concept);
    if (!footprint) return;

    if (footprint.atomicKey !== undefined) {
      this.pruneSet(this.atomicIndex, footprint.atomicKey, concept);
    }
    if (footprint.temporalKey !== undefined) {
      this.pruneSet(this.temporalIndex, footprint.temporalKey, concept);
    }
    this.activationIndex.delete(concept);

    const entry = footprint.inverseEntry;
    if (entry) {
      entry.concepts.delete(concept);
      for (const subterm of footprint.subterms) {
        const bucket = entry.subtermIndices.get(subterm);
        if (!bucket) continue;
        bucket.delete(concept);
        if (bucket.size === 0) entry.subtermIndices.delete(subterm);
      }
      if (entry.concepts.size === 0) this.inverseIndex.delete(entry.term);
    }

    for (const cluster of footprint.clusters) {
      const at = cluster.concepts.indexOf(concept);
      if (at >= 0) cluster.concepts.splice(at, 1);
      if (cluster.concepts.length === 0) this.similarityIndex.delete(cluster.term);
    }
  }

  clear(): void {
    this.footprints.clear();
    this.atomicIndex.clear();
    this.temporalIndex.clear();
    this.activationIndex.clear();
    this.inverseIndex.clear();
    this.similarityIndex.clear();
  }

  /** Atoms index by their symbol; compounds by the canonical structural key. */
  private atomicKey(term: Term): string {
    return isAtomic(term) ? term.symbol : termKey(term);
  }

  private pruneSet<K>(index: Map<K, Set<Concept>>, key: K, concept: Concept): void {
    const bucket = index.get(key);
    if (!bucket) return;
    bucket.delete(concept);
    if (bucket.size === 0) index.delete(key);
  }

  private indexByInverse(concept: Concept, footprint: ConceptFootprint): void {
    const term = concept.term;
    const entry = getOrInsertInverse(this.inverseIndex, term);
    footprint.inverseEntry = entry;
    entry.concepts.add(concept);
    this.indexSubterms([term], concept, entry, footprint);
  }

  private indexSubterms(
    terms: readonly Term[],
    concept: Concept,
    entry: InverseIndexEntry,
    footprint: ConceptFootprint
  ): void {
    for (const term of terms) {
      getOrInsertTermSet(entry.subtermIndices, term).add(concept);
      footprint.subterms.push(term);
      if (term.kind !== 'atom' && term.args?.length) {
        this.indexSubterms(term.args, concept, entry, footprint);
      }
    }
  }

  private indexBySimilarity(concept: Concept, footprint: ConceptFootprint): void {
    const term = concept.term;
    const cluster = getOrInsertCluster(this.similarityIndex, term, concept);
    footprint.clusters.push(cluster);
    insertByScoreDesc(cluster.concepts, concept, (c) => c.priority);
    if (cluster.representative.priority < concept.priority) cluster.representative = concept;
  }
}
