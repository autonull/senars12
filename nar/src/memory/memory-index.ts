import { addToSet, removeFromSet, unique } from '@senars/util';

import { atomKey, termKey } from '../terms';
import type { Concept } from './concept.js';

/** Every family defaults on; a caller opts out of the ones it does not maintain. */
export interface MemoryIndexConfig {
  /** Concepts whose whole term is that atom, keyed by `atomKey`. */
  enableAtomicIndex?: boolean;
  /** Concepts bucketed by the second they were admitted. */
  enableTemporalIndex?: boolean;
}

const DEFAULT_INDEX_CONFIG: Required<MemoryIndexConfig> = Object.freeze({
  enableAtomicIndex: true,
  enableTemporalIndex: true,
});

/**
 * Two lookup families over the concept store, and nothing else.
 *
 * This held five. Three of them — an activation snapshot, a recursive subterm
 * index and a similarity cluster map — were maintained on every admission and
 * torn down on every removal, and **no production caller ever read any of them**:
 * the activation value was a copy of `concept.priority` taken once at admission,
 * so it went stale the moment anything touched the concept; and the cluster map
 * held one cluster per distinct term, which made `indexedConcepts()` yield the
 * entire store — a full walk wearing an index's name, plus a sorted insert and a
 * footprint object per admission to keep it in step. Similarity retrieval reads
 * the store now, which is what it was doing behind the index anyway.
 *
 * So what remains are the two families whose reads reach a port
 * (`queryBySymbol`, `queryByTimeRange`), and each doc comment says what it can
 * actually find. An index that cannot narrow a search is a cost with no ceiling.
 */
export class MemoryIndex {
  private readonly atomicIndex: Map<string, Set<Concept>>;
  private readonly temporalIndex: Map<number, Set<Concept>>;
  /**
   * Only the bucket a concept was filed in, because unlike the atomic key it is
   * not derivable from the term — it came from an admission timestamp nothing
   * else records. One number per concept, where the five families needed an
   * object holding a key, an entry reference and two arrays.
   */
  private readonly temporalKeys = new Map<Concept, number>();
  private config: Required<MemoryIndexConfig>;
  private readonly temporalResolution = 1000;

  constructor(config: MemoryIndexConfig = {}) {
    this.config = { ...DEFAULT_INDEX_CONFIG, ...config };
    this.atomicIndex = new Map();
    this.temporalIndex = new Map();
  }

  get stats(): { atomic: number; temporal: number } {
    return {
      atomic: this.atomicIndex.size,
      temporal: this.temporalIndex.size,
    };
  }

  index(concept: Concept, timestamp: number = Date.now()): void {
    if (this.config.enableAtomicIndex) {
      addToSet(this.atomicIndex, termKey(concept.term), concept);
    }
    if (this.config.enableTemporalIndex) {
      const key = Math.floor(timestamp / this.temporalResolution);
      addToSet(this.temporalIndex, key, concept);
      this.temporalKeys.set(concept, key);
    }
  }

  /**
   * Concepts whose *whole* term is `symbol`.
   *
   * A compound term keys as `kind:a,b`, so it is filed here under a key no caller
   * can spell — a compound is findable by its parts, not by a symbol it merely
   * mentions.
   */
  getByAtomic(symbol: string): Concept[] {
    const set = this.atomicIndex.get(atomKey(symbol));
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

    return unique(results);
  }

  /** Both keys are cheap reads — `termKey` is memoized on the term — so removal never scans. */
  remove(concept: Concept): void {
    if (this.config.enableAtomicIndex) {
      removeFromSet(this.atomicIndex, termKey(concept.term), concept);
    }
    const temporalKey = this.temporalKeys.get(concept);
    if (temporalKey !== undefined) {
      this.temporalKeys.delete(concept);
      removeFromSet(this.temporalIndex, temporalKey, concept);
    }
  }

  clear(): void {
    this.atomicIndex.clear();
    this.temporalIndex.clear();
    this.temporalKeys.clear();
  }
}
