/**
 * Enhanced Memory system with integrated indexing, focus, archive, scoring, and consolidation
 */

import {Concept, type ConceptTaskType} from './concept.js';
import type {Term} from '../terms';
import type {Truth} from '../terms';
import type {Budget} from '../types';
import {getBudgetValue} from '../types';
import {MemoryIndex} from './memory-index.js';
import {Focus} from './focus.js';
import {Archive} from './archive.js';
import {MemoryScorer} from './scorer.js';
import {MemoryConsolidation} from './consolidation.js';
import {Forgetting} from './forgetting.js';
import type {ForgettingPolicy} from './forgetting.js';

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
  forgettingPolicy: 'fifo'
};

export interface MemoryStatistics {
  totalConcepts: number;
  totalTasks: number;
  focusedConcepts: number;
  archivedConcepts: number;
  indexStats?: { atomic: number; temporal: number; activation: number };
  archiveStats?: { size: number; capacity: number; utilization: number };
}

export class Memory {
  private readonly concepts = new Map<number, Concept>();
  private readonly config: Required<MemoryConfig>;
  private readonly index: MemoryIndex;
  private readonly focus: Focus;
  private readonly archive: Archive;
  private readonly scorer: MemoryScorer;
  private readonly consolidation: MemoryConsolidation;
  private readonly forgetting: Forgetting;
  private cyclesSinceConsolidation = 0;
  private lastTimestamp = Date.now();

  constructor(config: MemoryConfig = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.index = new MemoryIndex({
      enableAtomicIndex: this.config.enableIndexing,
      enableTemporalIndex: this.config.enableIndexing,
      enableActivationIndex: true
    });
    this.focus = new Focus({
      maxConcepts: this.config.focusMaxConcepts,
      attentionThreshold: this.config.focusThreshold
    });
    this.archive = new Archive({
      maxArchivedConcepts: this.config.archiveMaxConcepts,
      archiveThreshold: this.config.archiveThreshold
    });
    this.scorer = new MemoryScorer();
    this.consolidation = new MemoryConsolidation();
    this.forgetting = new Forgetting(this.config.forgettingPolicy);
  }

  get size(): number {
    return this.concepts.size;
  }

  getConcept(term: Term): Concept | undefined {
    return this.concepts.get(term.hash);
  }

  addConcept(term: Term): Concept {
    const existing = this.concepts.get(term.hash);
    if (existing) return existing;

    if (this.concepts.size >= this.config.maxConcepts) {
      this.applyForgetting();
    }

    const concept = new Concept(term);
    this.concepts.set(term.hash, concept);

    if (this.config.enableIndexing) {
      this.index.index(concept, this.lastTimestamp);
    }

    this.updateFocus(concept);

    return concept;
  }

  addTask(term: Term, type: ConceptTaskType, truth?: Truth, budget: Budget | number = 0.9): boolean {
    const concept = this.getConcept(term) ?? this.addConcept(term);
    return concept.addTask(type, {term, truth, budget: getBudgetValue(budget)});
  }

  removeConcept(term: Term): boolean {
    const concept = this.concepts.get(term.hash);
    if (concept) {
      this.focus.removeFromFocus(concept);
      if (this.config.enableIndexing) {
        this.index.remove(concept);
      }
      this.concepts.delete(term.hash);
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
      score: this.scorer.scoreForRetrieval(concept)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.concept);
  }

  consolidate(): void {
    if (++this.cyclesSinceConsolidation < this.config.consolidationInterval) return;
    this.cyclesSinceConsolidation = 0;

    const {activationDecayRate, priorityThreshold} = this.config;

    for (const concept of this.concepts.values()) {
      concept.decay(activationDecayRate);
    }

    const toArchive: Concept[] = [];
    const toRemove: Concept[] = [];

    for (const [hash, concept] of this.concepts) {
      const score = this.scorer.scoreForConsolidation(concept);
      if (concept.priority < priorityThreshold && concept.totalTasks === 0) {
        if (this.config.enableArchive && concept.priority < this.config.archiveThreshold) {
          toArchive.push(concept);
        } else {
          toRemove.push(concept);
        }
      }
    }

    if (this.config.enableArchive) {
      for (const concept of toArchive) {
        this.archiveConcept(concept);
      }
    }

    for (const concept of toRemove) {
      this.removeConcept(concept.term);
    }

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
  }

  getStatistics(): MemoryStatistics {
    let totalTasks = 0;
    for (const concept of this.concepts.values()) {
      totalTasks += concept.totalTasks;
    }

    const stats: MemoryStatistics = {
      totalConcepts: this.concepts.size,
      totalTasks,
      focusedConcepts: this.focus.size,
      archivedConcepts: this.config.enableArchive ? this.archive.size : 0
    };

    if (this.config.enableIndexing) {
      stats.indexStats = this.index.stats;
    }

    if (this.config.enableArchive) {
      stats.archiveStats = this.archive.stats;
    }

    return stats;
  }

  retrieveFromArchive(term: Term): Concept | undefined {
    if (!this.config.enableArchive) return undefined;
    const concept = this.archive.retrieve(term.hash);
    if (concept) {
      this.archive.unarchive(term.hash);
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
}

// Serialization
export { serialize, deserialize, validate, repair, type SerializedMemory } from './serialization.js';
