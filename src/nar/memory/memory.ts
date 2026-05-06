/**
 * Memory system for storing and managing concepts
 */

import { Concept, type ConceptTaskType as TaskType } from './concept.js';
import type { Term } from '../terms/types.js';
import type { Truth } from '../terms/truth.js';
import type { Budget } from '../task/task.js';
import { getBudgetValue } from '../types/core.js';

export interface MemoryConfig {
  maxConcepts: number;
  priorityThreshold: number;
  activationDecayRate: number;
  consolidationInterval: number;
}

const DEFAULT_CONFIG: MemoryConfig = {
  maxConcepts: 1000,
  priorityThreshold: 0.5,
  activationDecayRate: 0.01,
  consolidationInterval: 10
};

export class Memory {
  private concepts = new Map<number, Concept>();
  private focusConcepts = new Set<number>();
  private config: MemoryConfig;
  private cyclesSinceConsolidation = 0;

  constructor(config: MemoryConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  getConcept(term: Term): Concept | undefined {
    return this.concepts.get(term.hash);
  }

  addConcept(term: Term): Concept {
    const existing = this.concepts.get(term.hash);
    if (existing) return existing;
    if (this.concepts.size >= this.config.maxConcepts) this.applyForgetting();
    const concept = new Concept(term);
    this.concepts.set(term.hash, concept);
    return concept;
  }

  addTask(term: Term, type: TaskType, truth?: Truth, budget: Budget | number = 0.9): boolean {
    const concept = this.getConcept(term) ?? this.addConcept(term);
    return concept.addTask(type, { term, truth, budget: getBudgetValue(budget) });
  }

  removeConcept(term: Term): boolean {
    const concept = this.concepts.get(term.hash);
    if (concept) {
      this.focusConcepts.delete(term.hash);
      this.concepts.delete(term.hash);
      return true;
    }
    return false;
  }

  getFocusConcepts(): Concept[] {
    return Array.from(this.focusConcepts)
      .map(h => this.concepts.get(h))
      .filter((c): c is Concept => c !== undefined);
  }

  sample(limit: number): Concept[] {
    return Array.from(this.concepts.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
  }

  consolidate(): void {
    if (++this.cyclesSinceConsolidation < this.config.consolidationInterval) return;
    this.cyclesSinceConsolidation = 0;

    for (const concept of this.concepts.values()) {
      concept.decay(this.config.activationDecayRate);
    }

    for (const [hash, concept] of this.concepts) {
      if (concept.priority < this.config.priorityThreshold && concept.totalTasks === 0) {
        this.concepts.delete(hash);
      }
    }

    this.updateFocus();
  }

  private applyForgetting(): void {
    const lowest = Array.from(this.concepts.values()).sort((a, b) => a.priority - b.priority)[0];
    if (lowest) this.removeConcept(lowest.term);
  }

  private updateFocus(): void {
    this.focusConcepts.clear();
    for (const [hash, concept] of this.concepts) {
      if (concept.priority >= this.config.priorityThreshold) this.focusConcepts.add(hash);
    }
  }

  get size(): number {
    return this.concepts.size;
  }
}
