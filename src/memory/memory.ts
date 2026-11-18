import {
  type BeliefTruth,
  BoundedRing,
  getOrInsert,
  nextInt,
  perPart,
  rankBy,
  type RandomSource,
  selectTopN,
  shareOf,
  sortBy,
} from '@senars/util';
import { LINK, PRESSURE } from '../constants.js';
import { NullAttentionModel } from '../strategies/attention/NullAttentionModel.js';
import type { AttentionModel } from '../strategies/types.js';
import {
  mentionsSymbol,
  Stamp,
  type Term,
  TermMap,
  type TermMapEntry,
  TermSet,
  Truth,
  termKey,
} from '../terms';
import { atom } from '../terms/impls/factory.js';
import type { Budget, Task } from '../types';
import { NEUTRAL_BUDGET } from '../types';
import { AssociativeRegistry, GraphMemory } from './associative.js';
import type { ConceptGraph } from './ConceptGraph.js';
import {
  Concept,
  type ConceptMergeResult,
  type ConceptTaskType,
  taskFromBagItem,
  type TaskData,
} from './concept.js';
import { DEFAULT_MEMORY_CONFIG, type MemoryConfig, type ResolvedMemoryConfig } from './config.js';
import { type EmbeddingGenerator, MockEmbeddingGenerator } from './embedding.js';
import { Focus } from './focus.js';
import type { MemoryHealth } from './health.js';
import { Archive, Forgetting } from './lifecycle';
import { LinkManager } from './links';
import { EmbeddingLayer } from './links/EmbeddingLayer.js';
import { LINK_LAYER } from './links/types.js';
import { MemoryIndex } from './memory-index.js';
import type { MemoryPorts, LinkPort, MemoryStatistics, StorePressure } from './ports/index.js';
import type { EvictionReport } from './pressure';
import { evictUnderPressure } from './pressure';
import { selectSimilar } from './similarity.js';
import { calculateConceptStats, storePressure, tallyConcepts } from './state';
import { filterByTerm } from './term-filter.js';

/** Stateless, so one instance serves every memory that was not given a model. */
const NULL_ATTENTION = new NullAttentionModel();

export interface RevisionEntry {
  /**
   * `termKey` of the revised term. The log is keyed, never rendered: nothing
   * reads this as text, so it carries the canonical structural identity rather
   * than a serialized form that two distinct terms can share.
   */
  termKey: string;
  truth: BeliefTruth;
  stampId: string;
  timestamp: number;
  source: 'input' | 'derivation' | 'revision' | 'inference';
}

export class Memory implements MemoryPorts {
  /** D17: bounded revision log capacity. */
  static readonly REVISION_LOG_CAP = 1000;
  #attentionModel: AttentionModel;
  private readonly concepts = new TermMap<Concept>();
  private readonly associative: AssociativeRegistry;
  private readonly config: ResolvedMemoryConfig;
  private readonly index: MemoryIndex;
  private readonly focus: Focus;
  private readonly archive: Archive;
  private readonly forgetting: Forgetting;
  private readonly linkManager: LinkManager;
  private readonly revisionLog = new BoundedRing<RevisionEntry>(Memory.REVISION_LOG_CAP);
  private lastRevisionTs = 0;
  private cyclesSinceConsolidation = 0;
  /** The last eviction pass's report, including whether it could free anything. */
  private lastEviction: EvictionReport | undefined;

  constructor(
    config: MemoryConfig = DEFAULT_MEMORY_CONFIG,
    options?: {
      attentionModel?: AttentionModel;
    }
  ) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.#attentionModel = options?.attentionModel ?? NULL_ATTENTION;
    this.index = new MemoryIndex({
      enableAtomicIndex: this.config.enableIndexing,
      enableTemporalIndex: this.config.enableIndexing,
    });
    this.focus = new Focus({
      maxConcepts: this.config.focusMaxConcepts,
    });
    this.archive = new Archive({
      maxArchivedConcepts: this.config.archiveMaxConcepts,
    });
    this.forgetting = new Forgetting(this.config.forgettingPolicy);
    this.linkManager = new LinkManager({
      defaultCapacity: this.config.linkCapacity,
      // One term-keyed layer; semantic similarity lives in the EmbeddingLayer
      // below, so a second term layer would only ever be an empty duplicate.
      layers: { term: this.config.termLinkCapacity },
      forgetPolicy: this.config.linkForgetPolicy,
      globalDecayRate: this.config.linkDecayRate,
      rng: this.config.bag.rng,
      clock: this.config.bag.clock,
    });

    // Every layer the manager owns is recallable by name; no second registry.
    this.associative = new AssociativeRegistry((name) => this.linkManager.getLayer(name));

    // Register EmbeddingLayer for semantic similarity (optional)
    if (config.enableEmbeddingLayer) {
      const embeddingLayer = new EmbeddingLayer({
        capacity: this.config.semanticLinkCapacity,
        similarityThreshold: LINK.SEMANTIC_MIN_SIMILARITY,
        maxLinksPerConcept: 20,
        generator: config.embeddingGenerator ?? new MockEmbeddingGenerator(),
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

  /** The link surface as a port, for consumers that need recall and nothing else. */
  links(): LinkPort {
    return this.linkManager;
  }

  beliefs(concept: Concept): TaskData[] {
    return concept.getBeliefs();
  }

  taskCount(concept: Concept): number {
    return concept.totalTasks;
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

  /**
   * A pure read: the stored goals, as tasks.
   *
   * It used to mint `Stamp.createInput()` for any goal admitted without one,
   * so a second call returned a different stamp for the same goal and
   * `Stamp.overlaps` / `noStampOverlap` reasoned about an id that could never
   * repeat. Stamps are minted once at admission (`Concept.addTask`) and read
   * here, which makes two reads of one goal return the same identity
   * (TODO29.a §4 row 5).
   */
  getGoals(): Task[] {
    const goals: Task[] = [];
    // `forEach` rather than `all()`: this walks every resident concept once per cycle,
    // and `all()` allocates a generator per bag to walk an array it already holds.
    for (const concept of this.concepts.values()) {
      concept.goalBag.forEach((g) => {
        goals.push(taskFromBagItem(g, 'goal', concept.priority));
      });
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
      .getLinks(term, { maxResults: limit })
      .map((link) => this.concepts.get(link.targetTerm))
      .filter((c): c is Concept => !!c);

    if (results.length === 0) results.push(...this.findSimilarConcepts(term, limit));
    return results;
  }

  findConcepts(pattern: string, limit = 10): Concept[] {
    return filterByTerm(this.concepts.values(), pattern, limit);
  }

  addConcept(term: Term): Concept {
    return getOrInsert(this.concepts, term, () => {
      if (this.concepts.size >= this.config.maxConcepts) this.applyForgetting();

      return this.adoptConcept(
        new Concept(term, {
          onRevision: (entry) => this.recordRevision(entry),
          bag: this.config.bag,
        })
      );
    });
  }

  /**
   * Make `concept` the live instance for its term. Adopting the instance rather
   * than rebuilding one is what lets an archived concept be restored with the
   * identity its links, tasks and revision history refer to.
   */
  private adoptConcept(concept: Concept): Concept {
    this.concepts.set(concept.term, concept);

    if (this.config.enableIndexing) this.index.index(concept);

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
    const concept = this.addConcept(term);
    const createdStamp = stamp ?? Stamp.createInput();
    return concept.addTask(type, { term, truth, budget, stamp: createdStamp });
  }

  getRevisionHistory(term: Term): RevisionEntry[] {
    const key = termKey(term);
    return rankBy(
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

  /**
   * The `n` highest-attention resident concepts: attention order, which is what
   * `topK` means to every consumer.
   *
   * This used to rank by `MemoryScorer.scoreForRetrieval`, a four-factor score
   * whose novelty and relevance had no signals at any call site and whose
   * recency was a literal `1` — so the score was a constant plus a scaled
   * priority, and the ranking was attention order wearing an indirection. What
   * replaced it is deliberately free of the clock: a ranking that read
   * `lastAccessedAt` would make two stores built in the same millisecond order
   * differently, which is the determinism invariant the scorer cannot have
   * (TODO29.a §4 row 3, §5.4).
   */
  topConcepts(n: number): Concept[] {
    // Over `values()` rather than `residentEntries()`: this is the default premise
    // source, called once per sampled concept per cycle, and the entry array is
    // only ever scanned — never indexed or kept. A sweep that walks the result
    // more than once still wants `residentEntries()`.
    return selectTopN(this.concepts.values(), n, (concept) => concept.priority);
  }

  /**
   * A random contiguous window of the priority-sorted store — the windowed-roulette
   * strategy's positional-local diversity.
   *
   * The window is taken from the whole sorted store rather than from `topConcepts`,
   * which returns *at most* `windowSize` concepts and so made the window the whole
   * result: the start offset was computed from an array that could not be longer
   * than the window, and the strategy's defining property never fired.
   */
  sampleWindow(windowSize: number, rng: RandomSource): Concept[] {
    if (windowSize <= 0) return [];
    // `toSorted` by the same key: `sortBy` wraps every entry in a `{item, key}` pair and
    // calls the key once per element *and* per comparison, so ranking cost C wrapper
    // objects and ~C log C closure calls per window.
    const sorted = this.residentEntries().toSorted((a, b) => b.value.priority - a.value.priority);
    const start = sorted.length > windowSize ? nextInt(rng, sorted.length - windowSize + 1) : 0;
    return sorted.slice(start, start + windowSize).map((entry) => entry.value);
  }

  consolidate(opts?: { cycleCount?: number }): void {
    const interval = this.config.consolidationInterval;
    if (++this.cyclesSinceConsolidation < interval) return;
    // The interval that actually elapsed, not a literal 1: `decay` takes the
    // cycles it is to deduct over, and consolidation on an interval of 10 is a
    // ten-cycle decay.
    const cyclesElapsed = perPart(this.cyclesSinceConsolidation, interval);
    this.cyclesSinceConsolidation = 0;

    this.attentionModel.tick(this, opts?.cycleCount ?? cyclesElapsed);

    const { linkDecayRate } = this.config;

    this.decayAll(cyclesElapsed);

    this.lastEviction = evictUnderPressure(this);

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

  /**
   * Pressure in `0..1`, the maximum of the store's own bounds rather than the
   * concept count alone (TODO29.a §5.8). {@link storePressure} owns the
   * derivation, so the eviction policy, the health report and the statistics
   * block cannot each read a different number for the same store.
   */
  capacityPressure(): number {
    return this.pressureBreakdown().capacity;
  }

  /** The two bounds behind {@link capacityPressure}, so a report names both. */
  pressureBreakdown(): StorePressure {
    return storePressure(this.totals(), this.config);
  }

  /** Totals without the tercile pass; what persistence serializes. */
  totals(): { totalConcepts: number; totalTasks: number } {
    return tallyConcepts(this.concepts.values());
  }

  getStatistics(): MemoryStatistics {
    const stats = calculateConceptStats(this.concepts.values());
    // One tally, not two: the bounds read the counts the pass above already
    // made rather than sweeping the store a second time to re-derive them.
    const { concepts, tasks, capacity: pressure } = storePressure(stats, this.config);
    const result: MemoryStatistics = {
      totalConcepts: stats.totalConcepts,
      totalTasks: stats.totalTasks,
      focusedConcepts: this.focus.size,
      archivedConcepts: this.config.enableArchive ? this.archive.size : 0,
      memoryPressure: pressure,
      utilization: pressure,
      pressureByBound: { concepts, tasks },
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
    // 10% of the store, not of the removal list: the two differ whenever the
    // list is the smaller pool, and shrinking the store is what bounds it.
    for (const concept of shareOf(toRemove, 0.1, 0, this.concepts.size)) {
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

  /**
   * The `limit` concepts most similar to `term`, ranked by `selectSimilar`.
   *
   * The candidate set is the whole store, as it has always been: the similarity
   * clusters this used to read were one cluster per distinct term, so
   * "searching the index" was walking every concept and scoring it. Nothing here
   * can narrow the search, so nothing here pretends to.
   */
  findSimilarConcepts(term: Term, limit = 10): Concept[] {
    return selectSimilar(this.concepts.values(), term, limit);
  }

  private recordRevision(entry: RevisionEntry): void {
    const ts = Math.max(entry.timestamp, this.lastRevisionTs + 1);
    this.lastRevisionTs = ts;
    // D17: bounded revision log (drop-oldest).
    this.revisionLog.push({ ...entry, timestamp: ts });
  }

  /**
   * The one decay sweep in the system, reached from {@link consolidate} and
   * nowhere else — so what a concept forgets is a function of elapsed
   * consolidation intervals rather than of how many times a sampler read the
   * store (TODO29.a §5.4). A concept already at zero stays there: its decay is
   * zero times the rate, so skipping it changes no value and saves the write.
   * Under pressure the tail of drained concepts is the majority of the
   * population.
   */
  private decayAll(cyclesElapsed: number): void {
    const rate = this.config.activationDecayRate;
    const concepts = this.residentEntries();
    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i]!.value;
      if (concept.priority <= 0) continue;
      const decay = this.attentionModel.decay(concept, cyclesElapsed, rate);
      if (decay !== 0) concept.writeAttention({ reason: 'decay', amount: decay });
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
    const concept = this.forgetting.selectVictim(this.concepts.values());
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

  /**
   * What the last eviction pass did. A pass that freed nothing reports
   * `reason: 'exhausted'` — a store at capacity whose policy provably could not
   * act is a condition an operator has to be able to see, and returning
   * `{ archived: 0, forgotten: 0 }` made it indistinguishable from a pass that
   * found nothing wrong (TODO29.a §5.8).
   */
  evictionReport(): EvictionReport | undefined {
    return this.lastEviction;
  }

  /** Resident concepts holding at least one link to a term that is no longer stored. */
  private findOrphanedLinks(): Concept[] {
    return [...this.concepts.values()].filter((concept) =>
      this.linkManager.getLinks(concept.term).some((link) => !this.concepts.has(link.targetTerm))
    );
  }
}

export {
  deserialize,
  repair,
  type SerializedMemory,
  serialize,
  validate,
} from './state/serialization.js';
