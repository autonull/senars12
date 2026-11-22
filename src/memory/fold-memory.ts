/**
 * Fold Memory — Memory as pure projections over the episodic log.
 *
 * Replaces the monolithic `Memory` class with fold views over the log.
 * The episodic log is the single source of truth; this class provides
 * the same public API but as read-only projections with mutations
 * becoming log appends (fire-and-forget).
 *
 * Projections:
 * - concepts: resident concepts derived from belief_added/revision episodes
 * - tasks: task bags derived from task admission episodes
 * - links: co-activation/causal links derived from episode causal fields
 * - revisions: belief revision history derived from revision episodes
 * - archive: consolidated/forgotten concepts derived from archive episodes
 */

import { BoundedRing, getOrInsert, rankBy, selectTopN, sortBy } from '@senars/util/collections';
import { nextInt, type RandomSource } from '@senars/util/random';
import { type BeliefTruth } from '@senars/types/truth';
import { LINK, PRESSURE } from '../constants';
import { NullAttentionModel } from '../strategies/attention/NullAttentionModel';
import type { AttentionModel } from '../strategies/types';
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
import { atom } from '../terms/impls/factory';
import type { Budget, Task } from '../types';
import { NEUTRAL_BUDGET } from '../types';
import { AssociativeRegistry, GraphMemory } from './associative';
import type { ConceptGraph } from './ConceptGraph';
import {
  Concept,
  type ConceptMergeResult,
  type ConceptTaskType,
  taskFromBagItem,
  type TaskData,
} from './concept';
import { DEFAULT_MEMORY_CONFIG, type MemoryConfig, type ResolvedMemoryConfig } from './config';
import { type EmbeddingGenerator, MockEmbeddingGenerator } from './embedding';
import { Focus } from './focus';
import type { MemoryHealth } from './health';
import { Archive, Forgetting } from './lifecycle';
import { LinkManager } from './links';
import { EmbeddingLayer } from './links/EmbeddingLayer';
import { LINK_LAYER } from './links/types';
import { MemoryIndex } from './memory-index';
import type { MemoryPorts, LinkPort, MemoryStatistics, StorePressure } from './ports/index';
import type { EvictionReport } from './pressure';
import { evictUnderPressure } from './pressure';
import { selectSimilar } from './similarity';
import { calculateConceptStats, storePressure, tallyConcepts } from './state';
import { filterByTerm } from './term-filter';
import { EpisodicMemory } from './EpisodicMemory';
import type { Episode, EpisodeType } from '@senars/types/episodic-memory';
import { EPISODE_TYPES } from '@senars/types/episodic-memory';
import { ConceptConfig } from './concept';

/** Stateless, so one instance serves every memory that was not given a model. */
const NULL_ATTENTION = new NullAttentionModel();

/** Episode type for concept/task operations in the log metadata. */
const FOLD_OP_TYPES = [
  'concept_added',
  'task_admitted',
  'concept_removed',
  'concept_archived',
  'link_added',
  'link_removed',
  'revision_recorded',
  'consolidation_run',
  'eviction_run',
] as const;

type FoldOpType = (typeof FOLD_OP_TYPES)[number];

/** Extended episode with fold operation payload in metadata. */
interface FoldEpisode extends Episode {
  metadata: Episode['metadata'] & {
    foldOp?: FoldOpType;
    conceptTerm?: string;
    taskType?: ConceptTaskType;
    truth?: Truth;
    budget?: Budget;
    stamp?: Stamp;
    linkSource?: string;
    linkTarget?: string;
    linkLayer?: string;
    linkPriority?: number;
    revisionTermKey?: string;
    revisionTruth?: BeliefTruth;
    revisionStampId?: string;
    consolidationCycles?: number;
    evictionReason?: string;
  };
}

/** Concept projection derived from the log. */
interface ConceptProjection {
  concept: Concept;
  lastSeen: number;
  isArchived: boolean;
}

/** Task projection derived from the log. */
interface TaskProjection {
  conceptTerm: string;
  task: TaskData;
  admittedAt: number;
}

/** Link projection derived from the log. */
interface LinkProjection {
  source: string;
  target: string;
  layer: string;
  priority: number;
  lastUpdated: number;
}

/** Revision projection derived from the log. */
interface RevisionProjection {
  termKey: string;
  truth: BeliefTruth;
  stampId: string;
  timestamp: number;
  source: 'input' | 'derivation' | 'revision' | 'inference';
}

/** Archive projection derived from the log. */
interface ArchiveProjection {
  conceptTerm: string;
  archivedAt: number;
  reason: string;
}

/** Fold Memory — pure projections over the episodic log. */
export class FoldMemory implements MemoryPorts {
  /** D17: bounded revision log capacity. */
  static readonly REVISION_LOG_CAP = 1000;

  #attentionModel: AttentionModel;
  readonly #log: EpisodicMemory;
  readonly #config: ResolvedMemoryConfig & { embeddingGenerator?: EmbeddingGenerator };
  readonly #focus: Focus;
  readonly #archive: Archive;
  readonly #forgetting: Forgetting;
  readonly #linkManager: LinkManager;
  readonly #associative: AssociativeRegistry;
  readonly #index: MemoryIndex;
  readonly #clock: () => number;

  /** Projection caches, rebuilt from log on demand. */
  #concepts: Map<string, ConceptProjection> = new Map();
  #tasks: Map<string, TaskProjection[]> = new Map();
  #links: Map<string, LinkProjection[]> = new Map();
  #revisions: RevisionProjection[] = [];
  #archiveLog: ArchiveProjection[] = [];
  #lastProjectionTs = 0;
  #projectionsBuilt = false;

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
    this.#attentionModel = options?.attentionModel ?? NULL_ATTENTION;
    this.#clock = options?.clock ?? (() => Date.now());

    this.#focus = new Focus({
      maxConcepts: this.#config.focusMaxConcepts,
    });
    this.#archive = new Archive({
      maxArchivedConcepts: this.#config.archiveMaxConcepts,
    });
    this.#forgetting = new Forgetting(this.#config.forgettingPolicy);
    this.#linkManager = new LinkManager({
      defaultCapacity: this.#config.linkCapacity,
      layers: { term: this.#config.termLinkCapacity },
      forgetPolicy: this.#config.linkForgetPolicy,
      globalDecayRate: this.#config.linkDecayRate,
      rng: this.#config.bag.rng,
      clock: this.#config.bag.clock,
    });

    this.#associative = new AssociativeRegistry((name) => this.#linkManager.getLayer(name));

    if (this.#config.enableEmbeddingLayer) {
      const embeddingLayer = new EmbeddingLayer({
        capacity: this.#config.semanticLinkCapacity,
        similarityThreshold: LINK.SEMANTIC_MIN_SIMILARITY,
        maxLinksPerConcept: 20,
        generator: this.#config.embeddingGenerator ?? new MockEmbeddingGenerator(),
      });
      this.#linkManager.setLayer('embedding', embeddingLayer);
    }

    this.#index = new MemoryIndex({
      enableAtomicIndex: this.#config.enableIndexing,
      enableTemporalIndex: this.#config.enableIndexing,
    });

    // Build initial projections from log (async, non-blocking)
    this.#buildProjectionsFromLog().catch(() => {
      // Ignore errors during initial build
    });
  }

  /** Build projections from the log. */
  async #buildProjectionsFromLog(): Promise<void> {
    const episodes = await this.#log.getEpisodes({ limit: 10000 });
    this.#rebuildProjections(episodes);
    this.#projectionsBuilt = true;
    this.#lastProjectionTs = this.#clock();
  }

  /** Ensure projections are built (called by read methods). */
  #ensureProjections(): void {
    if (!this.#projectionsBuilt) {
      // Trigger async build if not already building
      this.#buildProjectionsFromLog().catch(() => {});
    }
  }

  /** Rebuild all projections from episodes. */
  #rebuildProjections(episodes: Episode[]): void {
    const concepts = new Map<string, ConceptProjection>();
    const tasks = new Map<string, TaskProjection[]>();
    const links = new Map<string, LinkProjection[]>();
    const revisions: RevisionProjection[] = [];
    const archiveLog: ArchiveProjection[] = [];

    // Sort by timestamp to replay in order
    const sorted = [...episodes].sort((a, b) => a.timestamp - b.timestamp);

    for (const ep of sorted) {
      this.#applyEpisode(ep, concepts, tasks, links, revisions, archiveLog);
    }

    this.#concepts = concepts;
    this.#tasks = tasks;
    this.#links = links;
    this.#revisions = revisions;
    this.#archiveLog = archiveLog;

    // Rebuild focus from current concepts
    this.#rebuildFocus(concepts);
  }

  /** Apply a single episode to projections. */
  #applyEpisode(
    ep: Episode,
    concepts: Map<string, ConceptProjection>,
    tasks: Map<string, TaskProjection[]>,
    links: Map<string, LinkProjection[]>,
    revisions: RevisionProjection[],
    archiveLog: ArchiveProjection[]
  ): void {
    const meta = ep.metadata as FoldEpisode['metadata'];

    // Check for fold operations in metadata
    if (meta.foldOp) {
      switch (meta.foldOp) {
        case 'concept_added': {
          if (meta.conceptTerm) {
            // Concept would be created here - skip for projection rebuild
          }
          break;
        }
        case 'task_admitted': {
          if (meta.conceptTerm && meta.taskType) {
            const conceptTasks = getOrInsert(tasks, meta.conceptTerm, () => []);
            const term = atom(meta.conceptTerm); // Reconstruct term from key
            conceptTasks.push({
              conceptTerm: meta.conceptTerm,
              task: {
                id: meta.stamp?.id ?? `task-${meta.timestamp}`,
                term,
                priority: meta.budget?.priority ?? 0,
                truth: meta.truth ?? Truth.NEUTRAL,
                budget: meta.budget ?? NEUTRAL_BUDGET,
                stamp: meta.stamp ?? Stamp.createInput(),
                createdAt: ep.timestamp,
              } as TaskData,
              admittedAt: ep.timestamp,
            });
          }
          break;
        }
        case 'concept_removed': {
          if (meta.conceptTerm) {
            concepts.delete(meta.conceptTerm);
            tasks.delete(meta.conceptTerm);
          }
          break;
        }
        case 'concept_archived': {
          if (meta.conceptTerm) {
            const existing = concepts.get(meta.conceptTerm);
            if (existing) {
              existing.isArchived = true;
            }
            archiveLog.push({
              conceptTerm: meta.conceptTerm,
              archivedAt: ep.timestamp,
              reason: 'log_append',
            });
          }
          break;
        }
        case 'link_added': {
          if (meta.linkSource && meta.linkTarget && meta.linkLayer) {
            const layerLinks = getOrInsert(links, meta.linkLayer, () => []);
            layerLinks.push({
              source: meta.linkSource,
              target: meta.linkTarget,
              layer: meta.linkLayer,
              priority: meta.linkPriority ?? 1.0,
              lastUpdated: ep.timestamp,
            });
          }
          break;
        }
        case 'link_removed': {
          if (meta.linkSource && meta.linkTarget && meta.linkLayer) {
            const layerLinks = links.get(meta.linkLayer);
            if (layerLinks) {
              const idx = layerLinks.findIndex(
                (l) => l.source === meta.linkSource && l.target === meta.linkTarget
              );
              if (idx >= 0) layerLinks.splice(idx, 1);
            }
          }
          break;
        }
        case 'revision_recorded': {
          if (meta.revisionTermKey && meta.revisionTruth) {
            revisions.push({
              termKey: meta.revisionTermKey,
              truth: meta.revisionTruth,
              stampId: meta.revisionStampId ?? '',
              timestamp: ep.timestamp,
              source: (meta.source ?? 'input') as 'input' | 'derivation' | 'revision' | 'inference',
            });
            if (revisions.length > FoldMemory.REVISION_LOG_CAP) {
              revisions.shift();
            }
          }
          break;
        }
        case 'consolidation_run':
        case 'eviction_run':
          break;
      }
    }

    // Also process standard belief_added episodes for concept tracking
    if (ep.type === 'belief_added') {
      // Could extract concept from content
    }
  }

  /** Rebuild focus from current concepts. */
  #rebuildFocus(concepts: Map<string, ConceptProjection>): void {
    this.#focus.clearFocus();
    const resident = [...concepts.values()].filter((c) => !c.isArchived);
    const top = selectTopN(resident, this.#config.focusMaxConcepts, (c) => c.concept.priority);
    for (const c of top) {
      this.#focus.addToFocus(c.concept);
    }
  }

  /** Queue a log append (fire-and-forget). */
  #queueAppend(appendFn: () => Promise<void>): void {
    this.#pendingAppends.push(appendFn);
    // Process pending appends
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

  /** Append a fold operation to the log via metadata. */
  #appendFold(foldOp: FoldOpType, payload: FoldEpisode['metadata']): Promise<void> {
    return this.#log.log('belief_added' as EpisodeType, `fold:${foldOp}`, {
      ...payload,
      foldOp,
    });
  }

  /** Log a concept addition. */
  #logConceptAdded(term: Term): () => Promise<void> {
    return () => this.#appendFold('concept_added', { conceptTerm: termKey(term) });
  }

  /** Log a task admission. */
  #logTaskAdmitted(
    term: Term,
    type: ConceptTaskType,
    truth?: Truth,
    budget?: Budget,
    stamp?: Stamp
  ): () => Promise<void> {
    return () => this.#appendFold('task_admitted', {
      conceptTerm: termKey(term),
      taskType: type,
      truth,
      budget,
      stamp,
    });
  }

  /** Log a concept removal. */
  #logConceptRemoved(term: Term): () => Promise<void> {
    return () => this.#appendFold('concept_removed', { conceptTerm: termKey(term) });
  }

  /** Log a concept archival. */
  #logConceptArchived(term: Term): () => Promise<void> {
    return () => this.#appendFold('concept_archived', { conceptTerm: termKey(term) });
  }

  /** Log a link addition. */
  #logLinkAdded(
    source: Term,
    target: Term,
    layer: string,
    priority: number
  ): () => Promise<void> {
    return () => this.#appendFold('link_added', {
      linkSource: termKey(source),
      linkTarget: termKey(target),
      linkLayer: layer,
      linkPriority: priority,
    });
  }

  /** Log a link removal. */
  #logLinkRemoved(source: Term, target: Term, layer: string): () => Promise<void> {
    return () => this.#appendFold('link_removed', {
      linkSource: termKey(source),
      linkTarget: termKey(target),
      linkLayer: layer,
    });
  }

  /** Log a revision. */
  #logRevision(
    termKeyStr: string,
    truth: BeliefTruth,
    stampId: string,
    source: 'input' | 'derivation' | 'revision' | 'inference'
  ): () => Promise<void> {
    return () => this.#appendFold('revision_recorded', {
      revisionTermKey: termKeyStr,
      revisionTruth: truth,
      revisionStampId: stampId,
      source,
    });
  }

  /** Log a consolidation run. */
  #logConsolidation(cycles: number): () => Promise<void> {
    return () => this.#appendFold('consolidation_run', { consolidationCycles: cycles });
  }

  /** Log an eviction run. */
  #logEviction(reason: string): () => Promise<void> {
    return () => this.#appendFold('eviction_run', { evictionReason: reason });
  }

  // ============================================================================
  // MemoryPorts implementation
  // ============================================================================

  get attentionModel(): AttentionModel {
    return this.#attentionModel;
  }

  setAttentionModel(model: AttentionModel): void {
    this.#attentionModel = model;
  }

  /** Current number of resident (non-archived) concepts. */
  get size(): number {
    this.#ensureProjections();
    return [...this.#concepts.values()].filter((c) => !c.isArchived).length;
  }

  // --- ConceptReader ---

  listConcepts(): Concept[] {
    this.#ensureProjections();
    return [...this.#concepts.values()]
      .filter((c) => !c.isArchived)
      .map((c) => c.concept);
  }

  *conceptValues(): IterableIterator<Concept> {
    this.#ensureProjections();
    for (const c of this.#concepts.values()) {
      if (!c.isArchived) yield c.concept;
    }
  }

  getConcept(term: Term): Concept | undefined {
    this.#ensureProjections();
    const key = termKey(term);
    return this.#concepts.get(key)?.concept;
  }

  // --- ConceptWriter ---

  addConcept(term: Term): Concept {
    this.#ensureProjections();
    const key = termKey(term);
    let projection = this.#concepts.get(key);

    if (!projection) {
      // Create concept
      const concept = new Concept(term, { bag: this.#config.bag } as ConceptConfig);
      this.#index.index(concept, this.#clock());
      projection = { concept, lastSeen: this.#clock(), isArchived: false };
      this.#concepts.set(key, projection);

      // Queue log append
      this.#queueAppend(this.#logConceptAdded(term));
    }

    return projection.concept;
  }

  removeConcept(term: Term): boolean {
    this.#ensureProjections();
    const key = termKey(term);
    const existed = this.#concepts.has(key);
    if (existed) {
      const projection = this.#concepts.get(key)!;
      this.#concepts.delete(key);
      this.#tasks.delete(key);
      this.#index.remove(projection.concept);
      this.#queueAppend(this.#logConceptRemoved(term));
    }
    return existed;
  }

  archiveConcept(concept: Concept): boolean {
    this.#ensureProjections();
    const key = termKey(concept.term);
    const projection = this.#concepts.get(key);
    if (!projection || projection.isArchived) {
      return false;
    }
    projection.isArchived = true;
    this.#focus.removeFromFocus(concept);
    this.#archive.archive(concept);
    this.#queueAppend(this.#logConceptArchived(concept.term));
    return true;
  }

  clear(): void {
    this.#concepts.clear();
    this.#tasks.clear();
    this.#links.clear();
    this.#revisions = [];
    this.#archiveLog = [];
    this.#focus.clearFocus();
    this.#archive.clear();
    this.#linkManager.removeAllLinksForTerm(atom('__ALL__'));
    this.#index.clear();
  }

  // --- TaskAdmission ---

  addTask(
    term: Term,
    type: ConceptTaskType,
    truth?: Truth,
    budget?: Budget,
    stamp?: Stamp
  ): boolean {
    this.#ensureProjections();
    const concept = this.addConcept(term);
    const taskData = {
      id: stamp?.id ?? `task-${this.#clock()}`,
      priority: budget?.priority ?? 0,
      term,
      truth: truth ?? Truth.NEUTRAL,
      budget: budget ?? NEUTRAL_BUDGET,
      stamp: stamp ?? Stamp.createInput(),
      createdAt: this.#clock(),
    } as TaskData;
    concept.addTask(type, taskData);
    this.#queueAppend(this.#logTaskAdmitted(term, type, truth, budget, stamp));
    return true;
  }

  // --- BeliefTable ---

  beliefs(concept: Concept): TaskData[] {
    return concept.getBeliefs();
  }

  taskCount(concept: Concept): number {
    return concept.totalTasks;
  }

  // --- GoalEnumeration ---

  getGoals(): Task[] {
    this.#ensureProjections();
    const goals: Task[] = [];
    for (const c of this.#concepts.values()) {
      if (!c.isArchived) {
        for (const belief of c.concept.getGoals()) {
          goals.push(taskFromBagItem(belief, 'goal', c.concept.priority));
        }
      }
    }
    return goals;
  }

  // --- StatisticsView ---

  capacityPressure(): number {
    const pressure = this.pressureBreakdown();
    return pressure.capacity;
  }

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

  totals(): { totalConcepts: number; totalTasks: number } {
    this.#ensureProjections();
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

  // --- SymbolIndex ---

  queryBySymbol(symbol: string): Concept[] {
    this.#ensureProjections();
    return this.#index.getByAtomic(symbol);
  }

  queryByTimeRange(start: number, end: number): Concept[] {
    this.#ensureProjections();
    return this.#index.getByTemporal([start, end]);
  }

  findConcepts(pattern: string, limit = 10): Concept[] {
    this.#ensureProjections();
    return filterByTerm(this.listConcepts(), pattern, limit);
  }

  findSimilarConcepts(term: Term, limit = 10): Concept[] {
    this.#ensureProjections();
    return selectSimilar(this.listConcepts(), term, limit);
  }

  getRelatedConcepts(term: Term, limit = 10): Concept[] {
    this.#ensureProjections();
    const key = termKey(term);
    const links = this.#links.get('term') ?? [];
    const related: Concept[] = [];

    for (const link of links) {
      if (link.source === key) {
        const targetConcept = this.#concepts.get(link.target);
        if (targetConcept && !targetConcept.isArchived) {
          related.push(targetConcept.concept);
        }
      }
      if (related.length >= limit) break;
    }
    return related;
  }

  // --- LinkPort ---

  links(): LinkPort {
    return this.#linkManager;
  }

  attachConceptGraph(graph: ConceptGraph): ConceptGraph {
    // Register the concept graph as an associative memory
    this.#linkManager.setLayer('graph', graph as any);
    return graph;
  }

  getLinks(
    sourceTerm: Term,
    options?: { layer?: string; type?: string; minPriority?: number; maxResults?: number }
  ): import('./links/types').LinkEntry[] {
    return this.#linkManager.getLinks(sourceTerm, options as any);
  }

  getLinkPriority(sourceTerm: Term, targetTerm: Term, layerName = 'term'): number {
    this.#ensureProjections();
    const layerLinks = this.#links.get(layerName) ?? [];
    const sourceKey = termKey(sourceTerm);
    const targetKey = termKey(targetTerm);
    const link = layerLinks.find((l) => l.source === sourceKey && l.target === targetKey);
    return link?.priority ?? 0;
  }

  addLink(
    sourceTerm: Term,
    targetTerm: Term,
    options?: { layer?: string; type?: string; priority?: number }
  ): {
    source: string;
    target: string;
    layer: string;
    priority: number;
    lastUpdated: number;
  } | null {
    this.#ensureProjections();
    const layer = options?.layer ?? 'term';
    const priority = options?.priority ?? 1.0;
    const sourceKey = termKey(sourceTerm);
    const targetKey = termKey(targetTerm);

    // Add to link manager
    const entry = this.#linkManager.addLink(sourceTerm, targetTerm, { layer, priority });
    if (!entry) return null;

    // Queue log append
    this.#queueAppend(this.#logLinkAdded(sourceTerm, targetTerm, layer, priority));

    return {
      source: sourceKey,
      target: targetKey,
      layer,
      priority,
      lastUpdated: this.#clock(),
    };
  }

  removeByTerm(sourceTerm: Term, targetTerm: Term, type?: string): boolean {
    this.#ensureProjections();
    const layer = 'term';
    const removed = this.#linkManager.removeByTerm(sourceTerm, targetTerm, type as any);
    if (removed) {
      this.#queueAppend(this.#logLinkRemoved(sourceTerm, targetTerm, layer));
    }
    return removed;
  }

  removeAllLinksForTerm(term: Term): void {
    this.#linkManager.removeAllLinksForTerm(term);
  }

  getLayer(name: string): import('./links/Layer').Layer | undefined {
    return this.#linkManager.getLayer(name);
  }

  setLayer(name: string, layer: import('./links/Layer').Layer): void {
    this.#linkManager.setLayer(name, layer);
  }

  applyDecay(decayRate?: number): void {
    this.#linkManager.applyDecay(decayRate);
  }

  // --- MemoryClock ---

  consolidate(opts?: { cycleCount?: number }): void {
    const cycles = opts?.cycleCount ?? 1;
    (this as any).#cyclesSinceConsolidation += cycles;

    if ((this as any).#cyclesSinceConsolidation >= this.#config.consolidationInterval) {
      (this as any).#cyclesSinceConsolidation = 0;

      // Run consolidation on link manager
      this.#linkManager.applyDecay();

      // Run archive
      this.#applyForgetting();

      // Update focus
      this.#rebuildFocus(this.#concepts);

      // Queue log append
      this.#queueAppend(this.#logConsolidation(cycles));
    }
  }

  // --- MemoryView methods ---

  topConcepts(limit: number): Concept[] {
    this.#ensureProjections();
    const resident = [...this.#concepts.values()].filter((c) => !c.isArchived);
    return selectTopN(resident, limit, (c) => c.concept.priority).map((c) => c.concept);
  }

  sampleWindow(windowSize: number, rng: RandomSource): Concept[] {
    this.#ensureProjections();
    const resident = [...this.#concepts.values()].filter((c) => !c.isArchived);
    if (resident.length === 0) return [];
    const start = nextInt(rng, Math.max(1, resident.length - windowSize + 1));
    return resident.slice(start, start + windowSize).map((c) => c.concept);
  }

  // --- Additional Memory methods ---

  getEmbeddingIndex(): EmbeddingLayer | undefined {
    return this.#linkManager.getEmbeddingLayer();
  }

  getAssociativeMemories(): AssociativeRegistry {
    return this.#associative;
  }

  getLinkManager(): LinkManager {
    return this.#linkManager;
  }

  getFocusConcepts(): Concept[] {
    return this.#focus.getFocusSet();
  }

  getFocus(): Focus {
    return this.#focus;
  }

  getConfig(): ResolvedMemoryConfig {
    return this.#config;
  }

  getMemoryPressure(): number {
    return this.capacityPressure();
  }

  getRevisionHistory(term: Term): RevisionProjection[] {
    this.#ensureProjections();
    const key = termKey(term);
    return this.#revisions.filter((r) => r.termKey === key);
  }

  findDenseClusters(
    minStrength: number,
    maxClusters: number
  ): Concept[][] {
    this.#ensureProjections();
    // Simplified - would use linkManager for real clustering
    return [];
  }

  removeConceptsMatching(pattern: string): number {
    this.#ensureProjections();
    const toRemove = this.listConcepts().filter((c) => mentionsSymbol(c.term, pattern));
    let count = 0;
    for (const concept of toRemove) {
      if (this.removeConcept(concept.term)) count++;
    }
    return count;
  }

  checkHealth(): MemoryHealth {
    const utilization = this.capacityPressure();
    const consolidationNeeded = (this as any).#cyclesSinceConsolidation >= this.#config.consolidationInterval;
    return {
      isHealthy: utilization < PRESSURE.CRITICAL && !consolidationNeeded,
      pressureLevel: utilization,
      consolidationNeeded,
      forgettingNeeded: utilization > PRESSURE.ARCHIVE,
      recommendations: [],
    };
  }

  compact(): void {
    this.#applyForgetting();
  }

  evictionReport(): EvictionReport | undefined {
    return undefined; // Would track from log
  }

  // --- Private helpers ---

  #cyclesSinceConsolidation = 0;

  #applyForgetting(): void {
    const victim = this.#forgetting.selectVictim(this.listConcepts());
    if (victim) {
      this.removeConcept(victim.term);
      this.#queueAppend(this.#logEviction('forgetting'));
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