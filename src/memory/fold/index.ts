/**
 * Fold Memory — pure projections over the episodic log.
 *
 * The episodic log is the single source of truth; this class provides
 * the same public API but as read-only projections with mutations
 * becoming log appends (fire-and-forget).
 *
 * Projections:
 * - semantic: resident concepts derived from belief_added/revision episodes
 * - procedural: task bags derived from task admission episodes
 * - episodic: log replay and link/revision/archive projections
 */

import { BoundedRing, getOrInsert } from '@senars/util/collections';
import { nextInt, type RandomSource } from '@senars/util/random';
import type { BeliefTruth } from '@senars/types/truth';
import { LINK, PRESSURE } from '../../constants';
import { NullAttentionModel } from '../../strategies/attention/NullAttentionModel';
import type { AttentionModel } from '../../strategies/types';
import {
  Stamp,
  type Term,
  TermMap,
  type TermMapEntry,
  TermSet,
  Truth,
  termKey,
} from '../../terms';
import { atom } from '../../terms/impls/factory';
import type { Budget, Task } from '../../types';
import { NEUTRAL_BUDGET } from '../../types';
import { AssociativeRegistry, GraphMemory } from '../associative';
import type { ConceptGraph } from '../ConceptGraph';
import {
  Concept,
  type ConceptMergeResult,
  type ConceptTaskType,
  taskFromBagItem,
  type TaskData,
} from '../concept';
import { DEFAULT_MEMORY_CONFIG, type MemoryConfig, type ResolvedMemoryConfig } from '../config';
import { type EmbeddingGenerator, MockEmbeddingGenerator } from '../embedding';
import { Focus } from '../focus';
import type { MemoryHealth } from '../health';
import { Archive, Forgetting } from '../lifecycle';
import { LinkManager } from '../links';
import { EmbeddingLayer } from '../links/EmbeddingLayer';
import { LINK_LAYER } from '../links/types';
import { MemoryIndex } from '../memory-index';
import type { MemoryPorts, LinkPort, MemoryStatistics, StorePressure } from '../ports/index';
import type { EvictionReport } from '../pressure';
import { evictUnderPressure } from '../pressure';
import { selectSimilar } from '../similarity';
import { calculateConceptStats, storePressure, tallyConcepts } from '../state';
import { filterByTerm } from '../term-filter';
import { EpisodicMemory } from '../EpisodicMemory';
import type { Episode, EpisodeType } from '@senars/types/episodic-memory';
import { EPISODE_TYPES } from '@senars/types/episodic-memory';
import { ConceptConfig } from '../concept';
import type { Belief, Question, MemoryStats } from '../view';

import { SemanticFold } from './semantic';
import { ProceduralFold } from './procedural';
import {
  buildProjectionsFromLog,
  createFoldAppender,
  logConceptAdded,
  logTaskAdmitted,
  logConceptRemoved,
  logConceptArchived,
  logLinkAdded,
  logLinkRemoved,
  logRevision,
  logConsolidation,
  logEviction,
  rebuildFocus,
} from './episodic';

/** Fold Memory — pure projections over the episodic log. */
export class FoldMemory implements MemoryPorts {
  /** D17: bounded revision log capacity. */
  static readonly REVISION_LOG_CAP = 1000;

  readonly #log: EpisodicMemory;
  readonly #config: ResolvedMemoryConfig & { embeddingGenerator?: EmbeddingGenerator };
  readonly #clock: () => number;

  #semantic: SemanticFold;
  #procedural: ProceduralFold;
  #revisions: any[] = [];
  #archiveLog: any[] = [];
  #lastProjectionTs = 0;
  #projectionsBuilt = false;
  #cyclesSinceConsolidation = 0;

  /** Pending log appends (fire-and-forget). */
  #pendingAppends: Array<() => Promise<void>> = [];

  constructor(
    log: EpisodicMemory,
    config: MemoryConfig = DEFAULT_MEMORY_CONFIG,
    options?: {
      attentionModel?: AttentionModel;
      clock?: () => number;
    }
  ) {
    this.#log = log;
    this.#config = { ...DEFAULT_MEMORY_CONFIG, ...config } as ResolvedMemoryConfig & { embeddingGenerator?: EmbeddingGenerator };
    this.#clock = options?.clock ?? (() => Date.now());

    // Build initial projections from log (async, non-blocking)
    this.#buildProjectionsFromLog().catch(() => {
      // Ignore errors during initial build
    });
  }

  /** Build projections from the log. */
  async #buildProjectionsFromLog(): Promise<void> {
    const episodes = await this.#log.getEpisodes({ limit: 10000 });
    const { concepts, tasks, links, revisions, archiveLog } = buildProjectionsFromLog(episodes, this.#config);

    this.#semantic = new SemanticFold(concepts, this.#config, { clock: this.#clock });
    this.#procedural = new ProceduralFold(tasks, concepts, this.#clock);
    this.#revisions = revisions;
    this.#archiveLog = archiveLog;
    this.#projectionsBuilt = true;
    this.#lastProjectionTs = this.#clock();
  }

  /** Ensure projections are built (called by read methods). */
  #ensureProjections(): void {
    if (!this.#projectionsBuilt) {
      this.#buildProjectionsFromLog().catch(() => {});
    }
  }

  /** Queue a log append (fire-and-forget). */
  #queueAppend(appendFn: () => Promise<void>): void {
    this.#pendingAppends.push(appendFn);
    this.#processPendingAppends();
  }

  /** Process pending log appends. */
  async #processPendingAppends(): Promise<void> {
    while (this.#pendingAppends.length > 0) {
      const append = this.#pendingAppends.shift()!;
      try {
        await append();
      } catch {
        // Ignore log append errors
      }
    }
  }

  // ============================================================================
  // MemoryPorts implementation - delegate to semantic/procedural folds
  // ============================================================================

  get attentionModel(): AttentionModel {
    return this.#semantic.getFocus(); // This is a hack - need proper attention model
  }

  setAttentionModel(model: AttentionModel): void {
    // Would need to store attention model
  }

  /** Current number of resident (non-archived) concepts. */
  get size(): number {
    this.#ensureProjections();
    return this.#semantic.size;
  }

  // --- ConceptReader ---

  listConcepts(): Concept[] {
    this.#ensureProjections();
    return this.#semantic.listConcepts();
  }

  *conceptValues(): IterableIterator<Concept> {
    this.#ensureProjections();
    yield* this.#semantic.conceptValues();
  }

  getConcept(term: Term): Concept | undefined {
    this.#ensureProjections();
    return this.#semantic.getConcept(term);
  }

  // --- ConceptWriter ---

  addConcept(term: Term): Concept {
    this.#ensureProjections();
    const concept = this.#semantic.addConcept(term);
    this.#queueAppend(logConceptAdded(this.#log, term));
    return concept;
  }

  removeConcept(term: Term): boolean {
    this.#ensureProjections();
    const existed = this.#semantic.removeConcept(term);
    if (existed) {
      this.#queueAppend(logConceptRemoved(this.#log, term));
    }
    return existed;
  }

  archiveConcept(concept: Concept): boolean {
    this.#ensureProjections();
    const result = this.#semantic.archiveConcept(concept);
    if (result) {
      this.#queueAppend(logConceptArchived(this.#log, concept.term));
    }
    return result;
  }

  clear(): void {
    this.#ensureProjections();
    this.#semantic.clear();
    this.#procedural = new ProceduralFold(new Map(), new Map(), this.#clock);
    this.#revisions = [];
    this.#archiveLog = [];
  }

  // --- TaskAdmission ---

  addTask(
    term: Term,
    type: ConceptTaskType,
    truth?: any,
    budget?: Budget,
    stamp?: Stamp
  ): boolean {
    this.#ensureProjections();
    const concept = this.#semantic.addConcept(term);
    const result = this.#procedural.addTask(term, type, truth, budget, stamp);
    if (result) {
      this.#queueAppend(logTaskAdmitted(this.#log, term, type, truth, budget, stamp));
    }
    return result;
  }

  // --- BeliefTable ---

  beliefs(concept: Concept): TaskData[] {
    return this.#procedural.beliefs(concept);
  }

  taskCount(concept: Concept): number {
    return this.#procedural.taskCount(concept);
  }

  // --- GoalEnumeration ---

  getGoals(): Task[] {
    this.#ensureProjections();
    return this.#procedural.getGoals();
  }

  // --- Belief/Question Enumeration ---

  getBeliefs(): Belief[] {
    this.#ensureProjections();
    return this.#procedural.getBeliefs();
  }

  getQuestions(): Question[] {
    this.#ensureProjections();
    return this.#procedural.getQuestions();
  }

  // --- StatisticsView ---

  stats(): MemoryStats {
    return this.getStatistics();
  }

  capacityPressure(): number {
    return this.#semantic.capacityPressure();
  }

  pressureBreakdown(): StorePressure {
    return this.#semantic.pressureBreakdown();
  }

  totals(): { totalConcepts: number; totalTasks: number } {
    return this.#semantic.totals();
  }

  getStatistics(): MemoryStatistics {
    return this.#semantic.getStatistics();
  }

  // --- SymbolIndex ---

  queryBySymbol(symbol: string): Concept[] {
    this.#ensureProjections();
    return this.#semantic.queryBySymbol(symbol);
  }

  queryByTimeRange(start: number, end: number): Concept[] {
    this.#ensureProjections();
    return this.#semantic.queryByTimeRange(start, end);
  }

  findConcepts(pattern: string, limit = 10): Concept[] {
    this.#ensureProjections();
    return this.#semantic.findConcepts(pattern, limit);
  }

  findSimilarConcepts(term: Term, limit = 10): Concept[] {
    this.#ensureProjections();
    return this.#semantic.findSimilarConcepts(term, limit);
  }

  getRelatedConcepts(term: Term, limit = 10): Concept[] {
    this.#ensureProjections();
    return this.#semantic.getRelatedConcepts(term, limit);
  }

  // --- LinkPort ---

  links(): LinkPort {
    return this.#semantic.getLinkManager();
  }

  attachConceptGraph(graph: ConceptGraph): ConceptGraph {
    this.#semantic.getLinkManager().setLayer('graph', graph as any);
    return graph;
  }

  getLinks(
    sourceTerm: Term,
    options?: { layer?: string; type?: string; minPriority?: number; maxResults?: number }
  ): any[] {
    return this.#semantic.getLinkManager().getLinks(sourceTerm, options as any);
  }

  getLinkPriority(sourceTerm: Term, targetTerm: Term, layerName = 'term'): number {
    this.#ensureProjections();
    return this.#semantic.getLinkManager().getLinkPriority(sourceTerm, targetTerm, layerName);
  }

  addLink(
    sourceTerm: Term,
    targetTerm: Term,
    options?: { layer?: string; type?: string; priority?: number }
  ): any {
    this.#ensureProjections();
    const layer = options?.layer ?? 'term';
    const priority = options?.priority ?? 1.0;

    const entry = this.#semantic.getLinkManager().addLink(sourceTerm, targetTerm, { layer, priority });
    if (!entry) return null;

    this.#queueAppend(logLinkAdded(this.#log, sourceTerm, targetTerm, layer, priority));

    return {
      source: termKey(sourceTerm),
      target: termKey(targetTerm),
      layer,
      priority,
      lastUpdated: this.#clock(),
    };
  }

  removeByTerm(sourceTerm: Term, targetTerm: Term, type?: string): boolean {
    this.#ensureProjections();
    const layer = 'term';
    const removed = this.#semantic.getLinkManager().removeByTerm(sourceTerm, targetTerm, type as any);
    if (removed) {
      this.#queueAppend(logLinkRemoved(this.#log, sourceTerm, targetTerm, layer));
    }
    return removed;
  }

  removeAllLinksForTerm(term: Term): void {
    this.#semantic.getLinkManager().removeAllLinksForTerm(term);
  }

  getLayer(name: string): any {
    return this.#semantic.getLinkManager().getLayer(name);
  }

  setLayer(name: string, layer: any): void {
    this.#semantic.getLinkManager().setLayer(name, layer);
  }

  applyDecay(decayRate?: number): void {
    this.#semantic.getLinkManager().applyDecay(decayRate);
  }

  // --- MemoryClock ---

  consolidate(opts?: { cycleCount?: number }): void {
    const cycles = opts?.cycleCount ?? 1;
    this.#cyclesSinceConsolidation += cycles;

    if (this.#cyclesSinceConsolidation >= this.#config.consolidationInterval) {
      this.#cyclesSinceConsolidation = 0;

      this.#semantic.getLinkManager().applyDecay();
      this.#applyForgetting();
      this.#semantic.getFocus().clearFocus();
      rebuildFocus(this.#semantic.getFocus(), (this.#semantic as any).concepts, this.#config.focusMaxConcepts);

      this.#queueAppend(logConsolidation(this.#log, cycles));
    }
  }

  // --- MemoryView methods ---

  topConcepts(limit: number): Concept[] {
    this.#ensureProjections();
    return this.#semantic.topConcepts(limit);
  }

  sampleWindow(windowSize: number, rng: RandomSource): Concept[] {
    this.#ensureProjections();
    return this.#semantic.sampleWindow(windowSize, rng);
  }

  // --- Additional Memory methods ---

  getEmbeddingIndex(): any {
    return this.#semantic.getEmbeddingIndex();
  }

  getAssociativeMemories(): any {
    return this.#semantic.getAssociativeMemories();
  }

  getLinkManager(): LinkManager {
    return this.#semantic.getLinkManager();
  }

  getFocusConcepts(): Concept[] {
    return this.#semantic.getFocusConcepts();
  }

  getFocus(): Focus {
    return this.#semantic.getFocus();
  }

  getConfig(): ResolvedMemoryConfig {
    return this.#config;
  }

  getMemoryPressure(): number {
    return this.capacityPressure();
  }

  getRevisionHistory(term: Term): any[] {
    this.#ensureProjections();
    const key = termKey(term);
    return this.#revisions.filter((r) => r.termKey === key);
  }

  findDenseClusters(minStrength: number, maxClusters: number): Concept[][] {
    return this.#semantic.findDenseClusters(minStrength, maxClusters);
  }

  removeConceptsMatching(pattern: string): number {
    this.#ensureProjections();
    return this.#semantic.removeConceptsMatching(pattern);
  }

  checkHealth(): MemoryHealth {
    return this.#semantic.checkHealth();
  }

  compact(): void {
    this.#applyForgetting();
  }

  evictionReport(): EvictionReport | undefined {
    return undefined;
  }

  // --- Private helpers ---

  #applyForgetting(): void {
    const victim = (this.#semantic.getLinkManager() as any).selectVictim?.(this.listConcepts());
    if (victim) {
      this.removeConcept(victim.term);
      this.#queueAppend(logEviction(this.#log, 'forgetting'));
    }
  }
}

/** Create a FoldMemory instance. */
export function createFoldMemory(
  log: EpisodicMemory,
  config?: MemoryConfig,
  options?: { attentionModel?: AttentionModel; clock?: () => number }
): FoldMemory {
  return new FoldMemory(log, config, options);
}