/**
 * Enhanced Memory system with integrated indexing, focus, archive, scoring, and consolidation
 */

import {Concept, type ConceptMergeResult, type ConceptTaskType} from './concept.js';
import type {Term, Truth} from '../terms';
import {calculateSimilarity, TermMap} from '../terms';
import type {Budget} from '../types';
import {MemoryIndex} from './memory-index.js';
import {Focus} from './focus.js';
import {Archive} from './archive.js';
import {MemoryScorer} from './scorer.js';
import {MemoryConsolidation} from './consolidation.js';
import type {ForgettingPolicy} from './forgetting.js';
import {Forgetting} from './forgetting.js';
import {LinkManager} from './links';
import {LINK} from '../constants.js';
import {PressureDetector} from './pressure.js';
import {HealthMonitor, type MemoryHealth} from './health.js';
import {StatisticsCalculator} from './statistics.js';

export interface MemoryConfig {
  maxConcepts?: number;
  priorityThreshold?: number;
  activationDecayRate?: number;
  consolidationInterval?: number;
  focusMaxConcepts?: number;
  focusThreshold?: number;
  archiveThreshold?: number;
  archiveMaxConcepts?: number;
  enableIndexing?: boolean;
  enableArchive?: boolean;
  forgettingPolicy?: ForgettingPolicy;
  healthCheckInterval?: number;
  enablePressureDetection?: boolean;
  pressureThreshold?: number;
  linkCapacity?: number;
  termLinkCapacity?: number;
  semanticLinkCapacity?: number;
  linkForgetPolicy?: 'priority' | 'lru' | 'fifo' | 'random';
  linkDecayRate?: number;
}

const DEFAULT_CONFIG: Required<MemoryConfig> = {
  maxConcepts: 1000,
  priorityThreshold: 0.5,
  activationDecayRate: 0.01,
  consolidationInterval: 10,
  focusMaxConcepts: 50,
  focusThreshold: 0.3,
  archiveThreshold: 0.2,
  archiveMaxConcepts: 1000,
  enableIndexing: true,
  enableArchive: true,
  forgettingPolicy: 'fifo',
  healthCheckInterval: 1000,
  enablePressureDetection: true,
  pressureThreshold: 0.9,
  linkCapacity: 1000,
  termLinkCapacity: 1000,
  semanticLinkCapacity: 500,
  linkForgetPolicy: 'priority',
  linkDecayRate: 0.001,
};

export interface MemoryStatistics {
  totalConcepts: number;
  totalTasks: number;
  focusedConcepts: number;
  archivedConcepts: number;
  indexStats?: { atomic: number; temporal: number; activation: number };
  archiveStats?: { size: number; capacity: number; utilization: number };
  memoryPressure: number;
  utilization: number;
  conceptDistribution: {
    lowPriority: number;
    mediumPriority: number;
    highPriority: number;
  };
}

export class Memory {
  private readonly concepts = new TermMap<Concept>();
  private readonly config: Required<MemoryConfig>;
  private readonly index: MemoryIndex;
  private readonly focus: Focus;
  private readonly archive: Archive;
  private readonly scorer: MemoryScorer;
  private readonly consolidation: MemoryConsolidation;
  private readonly forgetting: Forgetting;
  private readonly linkManager: LinkManager;
  private readonly pressureDetector: PressureDetector;
  private readonly healthMonitor: HealthMonitor;
  private readonly statsCalculator: StatisticsCalculator;
  private cyclesSinceConsolidation = 0;
  private lastTimestamp = Date.now();
  private readonly healthCheckInterval: number;
  private lastHealthCheck = 0;
  private pressureLevel = 0;
  private readonly onMemoryPressure?: (level: number, memory: Memory) => void;

  constructor(
    config: MemoryConfig = DEFAULT_CONFIG,
    options?: { onMemoryPressure?: (level: number, memory: Memory) => void }
  ) {
    this.config = {...DEFAULT_CONFIG, ...config};
    this.healthCheckInterval = this.config.healthCheckInterval;
    this.onMemoryPressure = options?.onMemoryPressure;
    this.index = new MemoryIndex({
      enableAtomicIndex: this.config.enableIndexing,
      enableTemporalIndex: this.config.enableIndexing,
      enableActivationIndex: true,
    });
    this.focus = new Focus({
      maxConcepts: this.config.focusMaxConcepts,
      attentionThreshold: this.config.focusThreshold,
    });
    this.archive = new Archive({
      maxArchivedConcepts: this.config.archiveMaxConcepts,
      archiveThreshold: this.config.archiveThreshold,
    });
    this.scorer = new MemoryScorer();
    this.consolidation = new MemoryConsolidation();
    this.forgetting = new Forgetting(this.config.forgettingPolicy);
    this.linkManager = new LinkManager({
      defaultCapacity: config.linkCapacity ?? LINK.DEFAULT_CAPACITY,
      layers: {
        term: config.termLinkCapacity ?? LINK.TERM_LAYER_CAPACITY,
        semantic: config.semanticLinkCapacity ?? LINK.SEMANTIC_LAYER_CAPACITY,
      },
      forgetPolicy: config.linkForgetPolicy ?? LINK.FORGET_POLICY,
      globalDecayRate: config.linkDecayRate ?? LINK.DECAY_RATE,
    });
    this.pressureDetector = new PressureDetector(config);
    this.healthMonitor = new HealthMonitor({healthCheckInterval: this.config.healthCheckInterval});
    this.statsCalculator = new StatisticsCalculator();
  }

  get size(): number {
    return this.concepts.size;
  }

  getConcept(term: Term): Concept | undefined {
    return this.concepts.get(term);
  }

  getRelatedConcepts(term: Term, limit: number = 10): Concept[] {
    const results: Concept[] = [];
    const concept = this.concepts.get(term);
    if (!concept) return results;

    const links = this.linkManager.getLinks(term);
    for (const link of links.slice(0, limit)) {
      const linkedConcept = this.concepts.get(link.targetTerm);
      if (linkedConcept) {
        results.push(linkedConcept);
      }
    }

    if (results.length === 0) {
      const similar = this.findSimilarConcepts(term, limit);
      results.push(...similar);
    }

    return results.slice(0, limit);
  }

  findConcepts(pattern: string, limit: number = 10): Concept[] {
    const results: Concept[] = [];
    const patternLower = pattern.toLowerCase();
    for (const concept of this.concepts.values()) {
      if (concept.term.toString().toLowerCase().includes(patternLower)) {
        results.push(concept);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  getLinkManager(): LinkManager {
    return this.linkManager;
  }

  addConcept(term: Term): Concept {
    const existing = this.concepts.get(term);
    if (existing) return existing;

    if (this.concepts.size >= this.config.maxConcepts) {
      this.applyForgetting();
    }

    this.checkMemoryPressure();

    const concept = new Concept(term);
    this.concepts.set(term, concept);

    if (this.config.enableIndexing) {
      this.index.index(concept, this.lastTimestamp);
    }

    this.updateFocus(concept);

    return concept;
  }

  addTask(term: Term, type: ConceptTaskType, truth?: Truth, budget: Budget = {
    priority: 0.9,
    durability: 0.8,
    quality: 0.9,
    cycles: 0,
    depth: 0
  }): boolean {
    const concept = this.getConcept(term) ?? this.addConcept(term);
    return concept.addTask(type, {term, truth, budget});
  }

  removeConcept(term: Term): boolean {
    const concept = this.concepts.get(term);
    if (concept) {
      this.focus.removeFromFocus(concept);
      if (this.config.enableIndexing) {
        this.index.remove(concept);
      }
      const termLayer = this.linkManager.getLayer('term');
      if (termLayer && 'removeAllLinksForTerm' in termLayer) {
        (termLayer as any).removeAllLinksForTerm(term);
      }
      this.concepts.delete(term);
      return true;
    }
    return false;
  }

  getFocusConcepts(): Concept[] {
    return this.focus.getFocusSet();
  }

  sample(limit: number): Concept[] {
    const allConcepts = Array.from(this.concepts.values());
    const scored = allConcepts.map(concept => ({
      concept,
      score: this.scorer.scoreForRetrieval(concept),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.concept);
  }

  consolidate(): void {
    if (++this.cyclesSinceConsolidation < this.config.consolidationInterval) return;
    this.cyclesSinceConsolidation = 0;

    const {activationDecayRate, priorityThreshold, archiveThreshold, enableArchive, linkDecayRate} = this.config;

    for (const concept of this.concepts.values()) {
      concept.decay(activationDecayRate);
    }

    this.linkManager.applyDecay(linkDecayRate);

    const toArchive: Concept[] = [];
    const toRemove: Concept[] = [];

    for (const concept of this.concepts.values()) {
      if (concept.priority < priorityThreshold && concept.totalTasks === 0) {
        if (enableArchive && concept.priority < archiveThreshold) toArchive.push(concept);
        else toRemove.push(concept);
      }
    }

    if (enableArchive) toArchive.forEach(concept => this.archiveConcept(concept));
    toRemove.forEach(concept => this.removeConcept(concept.term));

    this.updateAllFocus();
  }

  archiveConcept(concept: Concept): boolean {
    if (this.config.enableArchive) {
      this.archive.archive(concept);
      this.index.remove(concept);
      return true;
    }
    return false;
  }

  listConcepts(): Concept[] {
    return Array.from(this.concepts.values());
  }

  clear(): void {
    this.concepts.clear();
    this.focus.clearFocus();
    if (this.config.enableIndexing) {
      this.index.clear();
    }
    if (this.config.enableArchive) {
      this.archive.clear();
    }
    this.linkManager.applyDecay(1);
  }

  getStatistics(): MemoryStatistics {
    const stats = {
      totalConcepts: 0,
      totalTasks: 0,
      lowPriority: 0,
      mediumPriority: 0,
      highPriority: 0,
    };

    for (const concept of this.concepts.values()) {
      stats.totalConcepts++;
      stats.totalTasks += concept.totalTasks;
      stats[concept.priority < 0.3 ? 'lowPriority' : concept.priority < 0.7 ? 'mediumPriority' : 'highPriority']++;
    }

    const result: MemoryStatistics = {
      totalConcepts: stats.totalConcepts,
      totalTasks: stats.totalTasks,
      focusedConcepts: this.focus.size,
      archivedConcepts: this.config.enableArchive ? this.archive.size : 0,
      memoryPressure: this.pressureLevel,
      utilization: this.concepts.size / this.config.maxConcepts,
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
    const concept = this.archive.retrieve(term);
    if (concept) {
      this.archive.unarchive(term);
      this.addConcept(term);
    }
    return concept;
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
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) return this.getLastHealth();
    this.lastHealthCheck = now;

    const utilization = this.concepts.size / this.config.maxConcepts;
    const consolidationNeeded = this.cyclesSinceConsolidation >= this.config.consolidationInterval;
    const forgettingNeeded = utilization > 0.8;

    return {
      isHealthy: utilization < 0.9 && !consolidationNeeded,
      pressureLevel: utilization,
      consolidationNeeded,
      forgettingNeeded,
      recommendations: [],
    };
  }

  compact(): void {
    const toRemove: Concept[] = [];

    for (const concept of this.concepts.values()) {
      if (concept.priority < 0.1 && concept.totalTasks === 0) {
        toRemove.push(concept);
      }
    }

    toRemove.sort((a, b) => a.priority - b.priority);
    const orphanedLinks = this.findOrphanedLinks();
    toRemove.push(...orphanedLinks);

    for (const concept of toRemove.slice(0, Math.ceil(this.concepts.size * 0.1))) {
      this.removeConcept(concept.term);
    }

    this.updateAllFocus();
  }

  getMemoryPressure(): number {
    return this.pressureLevel;
  }

  mergeConcepts(concepts: Concept[]): ConceptMergeResult | null {
    if (concepts.length < 2) return null;

    const primary = concepts[0];
    if (!primary) return null;
    const others = concepts.slice(1);

    for (const other of others) {
      if (!primary.canMergeWith(other, 0.85)) {
        return null;
      }
    }

    return primary.mergeWith(others);
  }

  findSimilarConcepts(term: Term, limit = 10): Concept[] {
    const allConcepts = Array.from(this.concepts.values());
    const scored = allConcepts.map(concept => ({
      concept,
      similarity: calculateSimilarity(concept, term),
    }));

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit).map(s => s.concept);
  }

  private applyForgetting(): void {
    const concept = this.forgetting.selectVictim(
      Array.from(this.concepts.values()),
      this.scorer
    );
    if (concept) {
      this.removeConcept(concept.term);
    }
  }

  private updateFocus(concept: Concept): void {
    this.focus.addToFocus(concept);
  }

  private updateAllFocus(): void {
    this.focus.clearFocus();
    for (const concept of this.concepts.values()) {
      if (concept.priority >= this.config.priorityThreshold) {
        this.focus.addToFocus(concept);
      }
    }
  }

  private getLastHealth(): MemoryHealth {
    const utilization = this.concepts.size / this.config.maxConcepts;
    const consolidationNeeded = this.cyclesSinceConsolidation >= this.config.consolidationInterval;
    return {
      isHealthy: utilization < 0.9 && !consolidationNeeded,
      pressureLevel: utilization,
      consolidationNeeded,
      forgettingNeeded: utilization > 0.8,
      recommendations: [],
    };
  }

  private checkMemoryPressure(): void {
    if (!this.config.enablePressureDetection) return;

    const utilization = this.concepts.size / this.config.maxConcepts;
    this.pressureLevel = utilization;

    if (utilization >= this.config.pressureThreshold) {
      this.onMemoryPressure?.(utilization, this);
      this.pressureDetector.respond(this, this.concepts.values());
      this.compact();
    }
  }

  private findOrphanedLinks(): Concept[] {
    const orphaned: Concept[] = [];

    for (const concept of this.concepts.values()) {
      const links = concept.getLinks();
      for (const link of links) {
        if (!this.concepts.has(link.concept.key)) {
          orphaned.push(concept);
          break;
        }
      }
    }

    return orphaned;
  }
}

// Serialization
export {
serialize,
deserialize,
validate,
repair,
type SerializedMemory,
} from './serialization.js';
