import { BoundedRing, occupancy, selectTopN, sortBy, sortByDesc } from '@senars/util';
import type { ResolvedBagSlot } from '../bag/registration';
import { LINK, PRESSURE } from '../constants.js';
import { NullAttentionModel } from '../strategies/attention/NullAttentionModel.js';
import type { AttentionModel } from '../strategies/types.js';
import type { Term } from '../terms';
import {
  mentionsSymbol,
  Stamp,
  TermMap,
  type TermMapEntry,
  TermSet,
  Truth,
  termKey,
} from '../terms';
import { atom } from '../terms/impls/factory.js';
import type { Budget, Task } from '../types';
import { NEUTRAL_BUDGET } from '../types';
import { nextInt } from '../utils/random.js';
import { AssociativeRegistry, GraphMemory } from './associative.js';
import type { ConceptGraph } from './ConceptGraph.js';
import { Concept, type ConceptMergeResult, type ConceptTaskType } from './concept.js';
import { Focus } from './focus.js';
import type { MemoryHealth } from './health.js';
import type { ForgettingPolicy } from './lifecycle';
import { Archive, Forgetting } from './lifecycle';
import { LinkManager } from './links';
import { EmbeddingLayer } from './links/EmbeddingLayer.js';
import { LINK_LAYER } from './links/types.js';
import { MemoryIndex } from './memory-index.js';
import { evictUnderPressure, MemoryScorer } from './pressure';
import { selectSimilar } from './similarity.js';
import { calculateConceptStats, tallyConcepts } from './state';
import { filterByTerm } from './term-filter.js';

export interface MemoryConfig {
  maxConcepts?: number;
  activationDecayRate?: number;
  consolidationInterval?: number;
  focusMaxConcepts?: number;
  archiveMaxConcepts?: number;
  enableIndexing?: boolean;
  enableArchive?: boolean;
  enableEmbeddingLayer?: boolean;
  forgettingPolicy?: ForgettingPolicy;
  enablePressureDetection?: boolean;
  linkCapacity?: number;
  termLinkCapacity?: number;
  semanticLinkCapacity?: number;
  linkForgetPolicy?: 'priority' | 'lru' | 'fifo' | 'random';
  linkDecayRate?: number;
  bag?: ResolvedBagSlot;
}

const DEFAULT_CONFIG: Required<MemoryConfig> = {
  maxConcepts: 1000,
  activationDecayRate: 0.01,
  consolidationInterval: 10,
  focusMaxConcepts: 50,
  archiveMaxConcepts: 1000,
  enableIndexing: true,
  enableArchive: true,
  enableEmbeddingLayer: true,
  forgettingPolicy: 'fifo',
  enablePressureDetection: true,
  linkCapacity: 1000,
  termLinkCapacity: 1000,
  semanticLinkCapacity: 500,
  linkForgetPolicy: 'priority',
  linkDecayRate: 0.001,
  bag: { implementation: 'priority' },
};

/** Stateless, so one instance serves every memory that was not given a model. */
const NULL_ATTENTION = new NullAttentionModel();

export interface RevisionEntry {
  /**
   * `termKey` of the revised term. The log is keyed, never rendered: nothing
   * reads this as text, so it carries the canonical structural identity rather
   * than a serialized form that two distinct terms can share.
   */
  termKey: string;
  truth: { frequency: number; confidence: number };
  stampId: string;
  timestamp: number;
  source: 'input' | 'derivation' | 'revision' | 'inference';
}

export interface MemoryStatistics {
  totalConcepts: number;
  totalTasks: number;
  focusedConcepts: number;
  archivedConcepts: number;
  indexStats?: { atomic: number; temporal: number; activation: number };
  archiveStats?: { size: number; capacity: number; utilization: number };
  memoryPressure: number;
  utilization: number;
  conceptDistribution: { lowPriority: number; mediumPriority: number; highPriority: number };
}

export class Memory {
  /** D17: bounded revision log capacity. */
  static readonly REVISION_LOG_CAP = 1000;
  #attentionModel: AttentionModel;
  private readonly concepts = new TermMap<Concept>();
  private readonly associative: AssociativeRegistry;
  private readonly config: Required<MemoryConfig>;
  private readonly index: MemoryIndex;
  private readonly focus: Focus;
  private readonly archive: Archive;
  private readonly scorer: MemoryScorer;
  private readonly forgetting: Forgetting;
  private readonly linkManager: LinkManager;
  private readonly revisionLog = new BoundedRing<RevisionEntry>(Memory.REVISION_LOG_CAP);
  private lastRevisionTs = 0;
  private cyclesSinceConsolidation = 0;
  private lastTimestamp = Date.now();

  constructor(
    config: MemoryConfig = DEFAULT_CONFIG,
    options?: {
      attentionModel?: AttentionModel;
    }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.#attentionModel = options?.attentionModel ?? NULL_ATTENTION;
    this.index = new MemoryIndex({
      enableAtomicIndex: this.config.enableIndexing,
      enableTemporalIndex: this.config.enableIndexing,
      enableActivationIndex: true,
      enableInverseIndex: this.config.enableIndexing,
      enableSimilarityIndex: this.config.enableIndexing,
    });
    this.focus = new Focus({
      maxConcepts: this.config.focusMaxConcepts,
    });
    this.archive = new Archive({
      maxArchivedConcepts: this.config.archiveMaxConcepts,
    });
    this.scorer = new MemoryScorer();
    this.forgetting = new Forgetting(this.config.forgettingPolicy);
    this.linkManager = new LinkManager({
      defaultCapacity: config.linkCapacity ?? LINK.DEFAULT_CAPACITY,
      // One term-keyed layer; semantic similarity lives in the EmbeddingLayer
      // below, so a second term layer would only ever be an empty duplicate.
      layers: { term: config.termLinkCapacity ?? LINK.TERM_LAYER_CAPACITY },
      forgetPolicy: config.linkForgetPolicy ?? LINK.FORGET_POLICY,
      globalDecayRate: config.linkDecayRate ?? LINK.DECAY_RATE,
      rng: this.config.bag.rng,
    });

    // Every layer the manager owns is recallable by name; no second registry.
    this.associative = new AssociativeRegistry((name) => this.linkManager.getLayer(name));

    // Register EmbeddingLayer for semantic similarity (optional)
    if (config.enableEmbeddingLayer) {
      const embeddingLayer = new EmbeddingLayer({
        capacity: config.semanticLinkCapacity ?? LINK.SEMANTIC_LAYER_CAPACITY,
        similarityThreshold: 0.6,
        maxLinksPerConcept: 20,
      });
      this.linkManager.setLayer('embedding', embeddingLayer);
    }
  }

  getEmbeddingIndex(): EmbeddingLayer | undefined {
    return this.linkManager.getEmbeddingLayer();
  }

  getAssociativeMemories(): AssociativeRegistry {
    return this.associative;
  }

  /** Publish the co-activation graph as the `graph` associative memory, replacing any prior one. */
  attachConceptGraph(graph: ConceptGraph): ConceptGraph {
    this.associative.register(new GraphMemory(graph));
    return graph;
  }

  get size(): number {
    return this.concepts.size;
  }

  getConcept(term: Term): Concept | undefined {
    return this.concepts.get(term);
  }

  getLinkManager(): LinkManager {
    return this.linkManager;
  }

  /**
   * The `attention` slot's live instance. Reading it is how the strategy layer
   * primes and decays; replacing it is how a reconfigure takes effect, which is
   * why it is a pair of accessors rather than a readonly field.
   */
  get attentionModel(): AttentionModel {
    return this.#attentionModel;
  }

  setAttentionModel(model: AttentionModel): void {
    this.#attentionModel = model;
  }

  listConcepts(): Concept[] {
    return Array.from(this.concepts.values());
  }

  *conceptValues(): IterableIterator<Concept> {
    for (const concept of this.concepts.values()) {
      yield concept;
    }
  }

  forEachConcept(fn: (concept: Concept) => void): void {
    const concepts = this.residentEntries();
    for (let i = 0; i < concepts.length; i++) fn(concepts[i]!.value);
  }

  /**
   * The concept collection's entries, for a full sweep.
   *
   * Read straight off the entries rather than through `values()`: the term
   * collection's iterator is a general-purpose one that calls a projection
   * closure per element, and three full sweeps per inference cycle — decay,
   * sampling, relevance propagation — turned that into two indirect calls for
   * every resident concept, every cycle. An index and a field read is the floor
   * for a sweep. The array is live, so a sweep may not add or remove concepts;
   * the sweeps in this class only ever mutate the concepts themselves.
   */
  private residentEntries(): TermMapEntry<Concept>[] {
    return this.concepts.getEntries();
  }

  getFocusConcepts(): Concept[] {
    return this.focus.getFocusSet();
  }

  getFocus(): Focus {
    return this.focus;
  }

  getGoals(): Task[] {
    const goals: Task[] = [];
    for (const concept of this.concepts.values()) {
      for (const g of concept.goalBag.toArray()) {
        const task: Task = {
          term: g.term,
          type: 'goal',
          truth: g.truth ?? Truth.NEUTRAL,
          budget: g.budget,
          stamp: g.stamp ?? Stamp.createInput(),
          occurrenceTime: (g.occurrenceTime ?? Date.now()) as Task['occurrenceTime'],
          derived: g.derived ?? false,
        };
        goals.push(task);
      }
    }
    return goals;
  }

  getConfig(): MemoryConfig {
    return this.config;
  }

  getMemoryPressure(): number {
    return this.capacityPressure();
  }

  getRelatedConcepts(term: Term, limit = 10): Concept[] {
    const concept = this.concepts.get(term);
    if (!concept) return [];

    const results = this.linkManager
      .getLinks(term)
      .slice(0, limit)
      .map((link) => this.concepts.get(link.targetTerm))
      .filter((c): c is Concept => !!c);

    if (results.length === 0) results.push(...this.findSimilarConcepts(term, limit));
    return results;
  }

  findConcepts(pattern: string, limit = 10): Concept[] {
    return filterByTerm(this.concepts.values(), pattern, limit);
  }

  addConcept(term: Term): Concept {
    const existing = this.concepts.get(term);
    if (existing) return existing;

    if (this.concepts.size >= this.config.maxConcepts) this.applyForgetting();

    return this.adoptConcept(
      new Concept(term, {
        onRevision: (entry) => this.recordRevision(entry),
        bag: this.config.bag,
      })
    );
  }

  /**
   * Make `concept` the live instance for its term. Adopting the instance rather
   * than rebuilding one is what lets an archived concept be restored with the
   * identity its links, tasks and revision history refer to.
   */
  private adoptConcept(concept: Concept): Concept {
    this.concepts.set(concept.term, concept);

    if (this.config.enableIndexing) this.index.index(concept, this.lastTimestamp);

    const embeddingIndex = this.getEmbeddingIndex();
    embeddingIndex?.indexConcept(concept.term).catch(() => {
      // Fire-and-forget; embedding index failures are non-fatal
    });

    this.updateFocus(concept);
    return concept;
  }

  addTask(
    term: Term,
    type: ConceptTaskType,
    truth?: Truth,
    budget: Budget = NEUTRAL_BUDGET,
    stamp?: Stamp
  ): boolean {
    const concept = this.getConcept(term) ?? this.addConcept(term);
    const createdStamp = stamp ?? Stamp.createInput();
    return concept.addTask(type, { term, truth, budget, stamp: createdStamp });
  }

  getRevisionHistory(term: Term): RevisionEntry[] {
    const key = termKey(term);
    return sortByDesc(
      this.revisionLog.filter((entry) => entry.termKey === key),
      (entry) => entry.timestamp
    );
  }

  removeConcept(term: Term): boolean {
    const concept = this.concepts.get(term);
    if (concept) {
      this.focus.removeFromFocus(concept);
      if (this.config.enableIndexing) this.index.remove(concept);
      this.linkManager.removeAllLinksForTerm(term);
      this.concepts.delete(term);
      return true;
    }
    return false;
  }

  sample(limit: number): Concept[] {
    this.decayAll();
    return this.topConcepts(limit);
  }

  /** The `n` highest-priority resident concepts, ranked by the retrieval score. */
  private topConcepts(n: number): Concept[] {
    return selectTopN(this.residentEntries(), n, (entry) =>
      this.scorer.scoreForRetrieval(entry.value)
    ).map((entry) => entry.value);
  }

  /**
   * Sample a random contiguous window of concepts from the priority-sorted array.
   * Used by windowed-roulette sampling strategy for positional-local diversity.
   */
  sampleWindow(windowSize: number, rng: () => number = Math.random): Concept[] {
    this.decayAll();
    const allConcepts = this.topConcepts(windowSize);

    if (allConcepts.length <= windowSize) return allConcepts;

    const maxStart = allConcepts.length - windowSize;
    const start = nextInt(rng, maxStart + 1);
    return allConcepts.slice(start, start + windowSize);
  }

  consolidate(opts?: { cycleCount?: number }): void {
    if (++this.cyclesSinceConsolidation < this.config.consolidationInterval) return;
    this.cyclesSinceConsolidation = 0;

    this.attentionModel.tick(this, opts?.cycleCount ?? this.cyclesSinceConsolidation);

    const { linkDecayRate } = this.config;

    this.decayAll();

    evictUnderPressure(this);

    this.linkManager.applyDecay(linkDecayRate);
    this.updateAllFocus();
  }

  findDenseClusters(
    minSize = 3,
    minLinkStrength = 0.5
  ): Array<{ concepts: Concept[]; hasAbstract: boolean }> {
    const clusters: Array<{ concepts: Concept[]; hasAbstract: boolean }> = [];
    const visited = new TermSet();

    this.forEachConcept((concept) => {
      if (visited.has(concept.term)) return;

      const cluster = this.bfsCluster(concept, minLinkStrength, visited);
      if (cluster.length >= minSize) {
        clusters.push({
          concepts: cluster,
          hasAbstract: cluster.some(
            (c) => mentionsSymbol(c.term, 'abstract') || mentionsSymbol(c.term, 'category')
          ),
        });
      }
    });

    return clusters;
  }

  createAbstractConcept(name: string, sourceConcepts: Concept[]): Concept {
    const abstractTerm = atom(name);
    const concept = this.addConcept(abstractTerm);

    for (const source of sourceConcepts) {
      this.linkManager.addLink(abstractTerm, source.term, { type: 'term-link', priority: 0.7 });
    }

    return concept;
  }

  removeConceptsMatching(pattern: string): number {
    const toRemove = filterByTerm(this.listConcepts(), pattern);
    for (const concept of toRemove) {
      this.removeConcept(concept.term);
    }
    return toRemove.length;
  }

  /**
   * Archive a concept out of the live store. The store removal is the point:
   * an archive that leaves the concept resident does not relieve
   * `capacityPressure()`, so eviction runs again every cycle against a
   * population it has already shed, and `retrieveFromArchive` returns a concept
   * that is simultaneously archived and live.
   */
  archiveConcept(concept: Concept): boolean {
    if (!this.config.enableArchive) return false;
    this.archive.archive(concept);
    return this.removeConcept(concept.term);
  }

  clear(): void {
    this.concepts.clear();
    this.focus.clearFocus();
    if (this.config.enableIndexing) this.index.clear();
    if (this.config.enableArchive) this.archive.clear();
    this.linkManager.applyDecay(1);
  }

  /** Occupancy of the concept store in `0..1` — the AIKR pressure signal. */
  capacityPressure(): number {
    return occupancy(this.concepts.size, this.config.maxConcepts);
  }

  /** Totals without the tercile pass; what persistence serializes. */
  totals(): { totalConcepts: number; totalTasks: number } {
    return tallyConcepts(this.concepts.values());
  }

  getStatistics(): MemoryStatistics {
    const stats = calculateConceptStats(this.concepts.values());
    const pressure = this.capacityPressure();
    const result: MemoryStatistics = {
      totalConcepts: stats.totalConcepts,
      totalTasks: stats.totalTasks,
      focusedConcepts: this.focus.size,
      archivedConcepts: this.config.enableArchive ? this.archive.size : 0,
      memoryPressure: pressure,
      utilization: pressure,
      conceptDistribution: {
        lowPriority: stats.lowPriority,
        mediumPriority: stats.mediumPriority,
        highPriority: stats.highPriority,
      },
    };

    if (this.config.enableIndexing) result.indexStats = this.index.stats;
    if (this.config.enableArchive) result.archiveStats = this.archive.stats;
    return result;
  }

  setConfig(updates: Partial<MemoryConfig>): void {
    Object.assign(this.config, updates);
  }

  retrieveFromArchive(term: Term): Concept | undefined {
    if (!this.config.enableArchive) return undefined;
    const concept = this.archive.unarchive(term);
    return concept ? this.adoptConcept(concept) : undefined;
  }

  queryBySymbol(symbol: string): Concept[] {
    if (!this.config.enableIndexing) return [];
    return this.index.getByAtomic(symbol);
  }

  queryByTimeRange(start: number, end: number): Concept[] {
    if (!this.config.enableIndexing) return [];
    return this.index.getByTemporal([start, end]);
  }

  checkHealth(): MemoryHealth {
    return this.computeHealth();
  }

  compact(): void {
    const toRemove = sortBy(
      this.listConcepts().filter((c) => c.priority < 0.1 && c.totalTasks === 0),
      (c) => c.priority
    );

    toRemove.push(...this.findOrphanedLinks());
    const removeCount = Math.ceil(this.concepts.size * 0.1);
    for (const concept of toRemove.slice(0, removeCount)) {
      this.removeConcept(concept.term);
    }
    this.updateAllFocus();
  }

  mergeConcepts(concepts: Concept[]): ConceptMergeResult | null {
    if (concepts.length < 2) return null;
    const primary = concepts[0];
    if (!primary) return null;
    const others = concepts.slice(1);
    for (const other of others) {
      if (!primary.canMergeWith(other, 0.85)) return null;
    }
    return primary.mergeWith(others);
  }

  findSimilarConcepts(term: Term, limit = 10): Concept[] {
    // Without an index the store itself is the only candidate set.
    const candidates = this.config.enableIndexing
      ? this.index.indexedConcepts()
      : this.concepts.values();
    return selectSimilar(candidates, term, limit);
  }

  private recordRevision(entry: RevisionEntry): void {
    const ts = Math.max(entry.timestamp, this.lastRevisionTs + 1);
    this.lastRevisionTs = ts;
    // D17: bounded revision log (drop-oldest).
    this.revisionLog.push({ ...entry, timestamp: ts });
  }

  private decayAll(): void {
    // Every `sample()` decays the whole population, and a concept that has
    // already decayed to zero stays there: its decay is zero times the rate, so
    // skipping it changes no value and saves the write. Under pressure the tail
    // of drained concepts is the majority of the population.
    const rate = this.config.activationDecayRate;
    const concepts = this.residentEntries();
    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i]!.value;
      const priority = concept.priority;
      if (priority <= 0) continue;
      const decay = this.attentionModel.decay(concept, 1, rate);
      if (decay !== 0) concept.priority = Math.max(0, priority - decay);
    }
  }

  private bfsCluster(start: Concept, minStrength: number, visited: TermSet): Concept[] {
    const cluster: Concept[] = [];
    const queue: Concept[] = [start];
    visited.add(start.term);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);

      const links = this.linkManager.getLinks(current.term);
      for (const link of links) {
        if (link.priority < minStrength) continue;
        const target = this.concepts.get(link.targetTerm);
        if (!target) continue;
        if (visited.has(target.term)) continue;

        visited.add(target.term);
        queue.push(target);
      }
    }

    return cluster;
  }

  private applyForgetting(): void {
    const concept = this.forgetting.selectVictim(Array.from(this.concepts.values()), this.scorer);
    if (concept) this.removeConcept(concept.term);
  }

  private updateFocus(concept: Concept): void {
    this.focus.addToFocus(concept);
  }

  private updateAllFocus(): void {
    this.focus.clearFocus();
    for (const concept of selectTopN(
      this.concepts.values(),
      this.config.focusMaxConcepts,
      (c) => c.priority
    )) {
      this.focus.addToFocus(concept);
    }
  }

  private computeHealth(): MemoryHealth {
    const utilization = this.capacityPressure();
    const consolidationNeeded = this.cyclesSinceConsolidation >= this.config.consolidationInterval;
    return {
      isHealthy: utilization < PRESSURE.CRITICAL && !consolidationNeeded,
      pressureLevel: utilization,
      consolidationNeeded,
      forgettingNeeded: utilization > PRESSURE.ARCHIVE,
      recommendations: [],
    };
  }

  private findOrphanedLinks(): Concept[] {
    return [...this.concepts.values()].filter((concept) => {
      let hasOrphan = false;
      concept.forEachLink((link) => {
        if (!this.concepts.has(link.concept.key)) hasOrphan = true;
      });
      return hasOrphan;
    });
  }
}

export {
  deserialize,
  repair,
  type SerializedMemory,
  serialize,
  validate,
} from './state/serialization.js';
