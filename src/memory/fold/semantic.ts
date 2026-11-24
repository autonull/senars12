/**
 * Semantic Fold — concept management and semantic memory operations.
 */

import { type Term, termKey } from '../../terms';
import { Concept } from '../concept';
import type { ConceptProjection } from './episodic';
import { Focus } from '../focus';
import { Archive } from '../lifecycle';
import { MemoryIndex } from '../memory-index';
import type { ResolvedMemoryConfig } from '../config';
import { LinkManager } from '../links';
import type { MemoryPorts } from '../ports/index';
import type { AttentionModel } from '../../strategies/types';
import type { EmbeddingGenerator } from '../embedding';

/** Semantic view over concepts. */
export class SemanticFold {
  readonly #concepts: Map<string, ConceptProjection> = new Map();
  readonly #focus: Focus;
  readonly #archive: Archive;
  readonly #index: MemoryIndex;
  readonly #linkManager: LinkManager;
  readonly #config: ResolvedMemoryConfig & { embeddingGenerator?: EmbeddingGenerator };
  readonly #clock: () => number;

  constructor(
    concepts: Map<string, ConceptProjection>,
    config: ResolvedMemoryConfig & { embeddingGenerator?: EmbeddingGenerator },
    options?: {
      attentionModel?: AttentionModel;
      clock?: () => number;
    }
  ) {
    this.#concepts = concepts;
    this.#config = config;
    this.#clock = options?.clock ?? (() => Date.now());

    this.#focus = new Focus({
      maxConcepts: config.focusMaxConcepts,
    });
    this.#archive = new Archive({
      maxArchivedConcepts: config.archiveMaxConcepts,
    });
    this.#linkManager = new LinkManager({
      defaultCapacity: config.linkCapacity,
      layers: { term: config.termLinkCapacity },
      forgetPolicy: config.linkForgetPolicy,
      globalDecayRate: config.linkDecayRate,
      rng: config.bag.rng,
      clock: config.bag.clock,
    });

    if (config.enableEmbeddingLayer) {
      const embeddingLayer = new EmbeddingLayer({
        capacity: config.semanticLinkCapacity,
        similarityThreshold: 0.8, // LINK.SEMANTIC_MIN_SIMILARITY
        maxLinksPerConcept: 20,
        generator: config.embeddingGenerator ?? new MockEmbeddingGenerator(),
      });
      this.#linkManager.setLayer('embedding', embeddingLayer);
    }

    this.#index = new MemoryIndex({
      enableAtomicIndex: config.enableIndexing,
      enableTemporalIndex: config.enableIndexing,
    });

    // Rebuild focus from current concepts
    this.#rebuildFocus();
  }

  /** Rebuild focus from current concepts. */
  #rebuildFocus(): void {
    this.#focus.clearFocus();
    const resident = [...this.#concepts.values()].filter((c) => !c.isArchived);
    const top = resident
      .sort((a, b) => b.concept.priority - a.concept.priority)
      .slice(0, this.#config.focusMaxConcepts);
    for (const c of top) {
      this.#focus.addToFocus(c.concept);
    }
  }

  /** Current number of resident (non-archived) concepts. */
  get size(): number {
    return [...this.#concepts.values()].filter((c) => !c.isArchived).length;
  }

  /** List all resident concepts. */
  listConcepts(): Concept[] {
    return [...this.#concepts.values()]
      .filter((c) => !c.isArchived)
      .map((c) => c.concept);
  }

  /** Iterate over resident concepts. */
  *conceptValues(): IterableIterator<Concept> {
    for (const c of this.#concepts.values()) {
      if (!c.isArchived) yield c.concept;
    }
  }

  /** Get a concept by term. */
  getConcept(term: Term): Concept | undefined {
    const key = termKey(term);
    return this.#concepts.get(key)?.concept;
  }

  /** Add a concept. */
  addConcept(term: Term): Concept {
    const key = termKey(term);
    let projection = this.#concepts.get(key);

    if (!projection) {
      const concept = new Concept(term, { bag: this.#config.bag } as any);
      this.#index.index(concept, this.#clock());
      projection = { concept, lastSeen: this.#clock(), isArchived: false };
      this.#concepts.set(key, projection);
    }

    return projection.concept;
  }

  /** Remove a concept. */
  removeConcept(term: Term): boolean {
    const key = termKey(term);
    const projection = this.#concepts.get(key);
    if (!projection) return false;

    this.#concepts.delete(key);
    this.#index.remove(projection.concept);
    return true;
  }

  /** Archive a concept. */
  archiveConcept(concept: Concept): boolean {
    const key = termKey(concept.term);
    const projection = this.#concepts.get(key);
    if (!projection || projection.isArchived) {
      return false;
    }
    projection.isArchived = true;
    this.#focus.removeFromFocus(concept);
    this.#archive.archive(concept);
    return true;
  }

  /** Clear all concepts. */
  clear(): void {
    this.#concepts.clear();
    this.#focus.clearFocus();
    this.#archive.clear();
    this.#linkManager.removeAllLinksForTerm({ op: 'atom', args: ['__ALL__'] } as any);
    this.#index.clear();
  }

  /** Get focus concepts. */
  getFocusConcepts(): Concept[] {
    return this.#focus.getFocusSet();
  }

  /** Get focus instance. */
  getFocus(): Focus {
    return this.#focus;
  }

  /** Get archive instance. */
  getArchive(): Archive {
    return this.#archive;
  }

  /** Get link manager. */
  getLinkManager(): LinkManager {
    return this.#linkManager;
  }

  /** Get memory index. */
  getIndex(): MemoryIndex {
    return this.#index;
  }

  /** Query concepts by atomic symbol. */
  queryBySymbol(symbol: string): Concept[] {
    return this.#index.getByAtomic(symbol);
  }

  /** Query concepts by time range. */
  queryByTimeRange(start: number, end: number): Concept[] {
    return this.#index.getByTemporal([start, end]);
  }

  /** Find concepts matching pattern. */
  findConcepts(pattern: string, limit = 10): Concept[] {
    return filterByTerm(this.listConcepts(), pattern, limit);
  }

  /** Find similar concepts. */
  findSimilarConcepts(term: Term, limit = 10): Concept[] {
    return selectSimilar(this.listConcepts(), term, limit);
  }

  /** Get related concepts via links. */
  getRelatedConcepts(term: Term, limit = 10): Concept[] {
    const key = termKey(term);
    const links = this.#linkManager.getLinks(term, { layer: 'term' });
    const related: Concept[] = [];

    for (const link of links) {
      if (link.source === key || link.target === key) {
        const otherKey = link.source === key ? link.target : link.source;
        const targetConcept = this.#concepts.get(otherKey);
        if (targetConcept && !targetConcept.isArchived) {
          related.push(targetConcept.concept);
        }
      }
      if (related.length >= limit) break;
    }
    return related;
  }

  /** Get top concepts by priority. */
  topConcepts(limit: number): Concept[] {
    const resident = [...this.#concepts.values()].filter((c) => !c.isArchived);
    return resident
      .sort((a, b) => b.concept.priority - a.concept.priority)
      .slice(0, limit)
      .map((c) => c.concept);
  }

  /** Sample a window of concepts. */
  sampleWindow(windowSize: number, rng: RandomSource): Concept[] {
    const resident = [...this.#concepts.values()].filter((c) => !c.isArchived);
    if (resident.length === 0) return [];
    const start = nextInt(rng, Math.max(1, resident.length - windowSize + 1));
    return resident.slice(start, start + windowSize).map((c) => c.concept);
  }

  /** Check health. */
  checkHealth(): MemoryHealth {
    const utilization = this.capacityPressure();
    return {
      isHealthy: utilization < 0.9, // PRESSURE.CRITICAL
      pressureLevel: utilization,
      consolidationNeeded: false,
      forgettingNeeded: utilization > 0.7, // PRESSURE.ARCHIVE
      recommendations: [],
    };
  }

  /** Compact memory. */
  compact(): void {
    // Apply forgetting
    // Would need forgetting instance
  }

  /** Get capacity pressure. */
  capacityPressure(): number {
    const totals = this.totals();
    const conceptPressure = totals.totalConcepts / this.#config.maxConcepts;
    const taskPressure = totals.totalTasks / this.#config.maxTasks;
    return Math.max(conceptPressure, taskPressure);
  }

  /** Get totals. */
  totals(): { totalConcepts: number; totalTasks: number } {
    let totalConcepts = 0;
    let totalTasks = 0;
    for (const c of this.#concepts.values()) {
      if (!c.isArchived) {
        totalConcepts++;
        totalTasks += c.concept.totalTasks;
      }
    }
    return { totalConcepts, totalTasks };
  }

  /** Get statistics. */
  getStatistics(): MemoryStatistics {
    const totals = this.totals();
    const pressure = this.pressureBreakdown();
    let lowPriority = 0, mediumPriority = 0, highPriority = 0;

    for (const c of this.#concepts.values()) {
      if (!c.isArchived) {
        const p = c.concept.priority;
        if (p < 0.33) lowPriority++;
        else if (p < 0.66) mediumPriority++;
        else highPriority++;
      }
    }

    return {
      totalConcepts: totals.totalConcepts,
      totalTasks: totals.totalTasks,
      focusedConcepts: this.#focus.size,
      archivedConcepts: this.#archive.size,
      indexStats: this.#index.stats,
      archiveStats: this.#archive.stats,
      memoryPressure: pressure.capacity,
      utilization: pressure.capacity,
      pressureByBound: { concepts: pressure.concepts, tasks: pressure.tasks },
      conceptDistribution: { lowPriority, mediumPriority, highPriority },
    };
  }

  /** Get pressure breakdown. */
  pressureBreakdown(): StorePressure {
    const totals = this.totals();
    const conceptPressure = totals.totalConcepts / this.#config.maxConcepts;
    const taskPressure = totals.totalTasks / this.#config.maxTasks;
    return {
      concepts: conceptPressure,
      tasks: taskPressure,
      capacity: Math.max(conceptPressure, taskPressure),
    };
  }

  /** Get revision history for a term. */
  getRevisionHistory(_term: Term): any[] {
    // Would need revisions from episodic
    return [];
  }

  /** Find dense clusters. */
  findDenseClusters(_minStrength: number, _maxClusters: number): Concept[][] {
    return [];
  }

  /** Remove concepts matching pattern. */
  removeConceptsMatching(pattern: string): number {
    const toRemove = this.listConcepts().filter((c) => c.term.toString().includes(pattern));
    let count = 0;
    for (const concept of toRemove) {
      if (this.removeConcept(concept.term)) count++;
    }
    return count;
  }

  /** Get embedding index. */
  getEmbeddingIndex() {
    return this.#linkManager.getEmbeddingLayer();
  }

  /** Get associative memories. */
  getAssociativeMemories() {
    // Would need associative registry
    return null;
  }
}

// Type imports
import { nextInt, type RandomSource } from '@senars/util/random';
import { EmbeddingLayer } from '../links/EmbeddingLayer';
import { MockEmbeddingGenerator } from '../embedding';
import { filterByTerm } from '../term-filter';
import { selectSimilar } from '../similarity';
import type { MemoryStatistics, StorePressure, MemoryHealth } from '../ports/index';