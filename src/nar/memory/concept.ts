/**
 * Concept class for memory storage with belief revision and deduplication
 */

import type {Term} from '../terms';
import type {Truth} from '../terms';
import {Bag} from './bag.js';
import {Truth as TruthOps} from '../terms/truth.js';

export interface TaskData {
  readonly term: Term;
  readonly truth?: Truth;
  readonly budget: number;
  readonly timestamp?: number;
}

export type ConceptTaskType = 'belief' | 'goal' | 'question' | 'command';

interface ConceptConfig {
  maxBeliefs?: number;
  maxGoals?: number;
  maxQuestions?: number;
}

export class Concept {
  readonly term: Term;
  readonly beliefBag: Bag<TaskData>;
  readonly goalBag: Bag<TaskData>;
  readonly questionBag: Bag<TaskData>;
  readonly createdAt: number;
  private _priority = 0;
  private activation = 0;
  private useCount = 0;
  private lastAccessed: number;
  readonly lastAccessTime: number;

  constructor(term: Term, config: ConceptConfig = {}) {
    this.term = term;
    this.beliefBag = new Bag(config.maxBeliefs ?? 100);
    this.goalBag = new Bag(config.maxGoals ?? 50);
    this.questionBag = new Bag(config.maxQuestions ?? 20);
    this.createdAt = Date.now();
    this.lastAccessed = Date.now();
    this.lastAccessTime = Date.now();
  }

  get key(): number {
    return this.term.hash;
  }

  get priority(): number {
    return this._priority;
  }

  set priority(value: number) {
    this._priority = Math.max(0, Math.min(1, value));
  }

  get activationValue(): number {
    return this.activation;
  }

  get totalTasks(): number {
    return this.beliefBag.size + this.goalBag.size + this.questionBag.size;
  }

  addTask(type: ConceptTaskType, data: TaskData): boolean {
    if (type === 'belief') {
      return this.addBeliefWithRevision(data);
    }

    const bag = type === 'goal' ? this.goalBag : this.questionBag;
    const added = bag.add(data, data.budget);
    if (added) {
      this.useCount++;
      this.lastAccessed = Date.now();
      this._priority = Math.min(1, this._priority + 0.1);
    }
    return added;
  }

  private addBeliefWithRevision(data: TaskData): boolean {
    const existing = this.findMatchingBelief(data.term);

    if (existing) {
      if (data.truth && existing.truth) {
        const revisedTruth = TruthOps.revision(data.truth, existing.truth);
        const revisedData = { ...data, truth: revisedTruth, timestamp: Date.now() };
        this.beliefBag.remove(existing);
        const added = this.beliefBag.add(revisedData, revisedData.budget);
        if (added) {
          this.useCount++;
          this.lastAccessed = Date.now();
          this._priority = Math.min(1, this._priority + 0.1);
        }
        return added;
      }
      return false;
    }

    const added = this.beliefBag.add(data, data.budget);
    if (added) {
      this.useCount++;
      this.lastAccessed = Date.now();
      this._priority = Math.min(1, this._priority + 0.1);
    }
    return added;
  }

  private findMatchingBelief(term: Term): TaskData | undefined {
    const items = this.beliefBag.getItems();
    for (const item of items) {
      if (item.term.hash === term.hash) {
        return item;
      }
    }
    return undefined;
  }

  hasMatchingBelief(term: Term): boolean {
    return this.findMatchingBelief(term) !== undefined;
  }

  getBeliefs(): TaskData[] {
    return this.beliefBag.getItems();
  }

  getGoals(): TaskData[] {
    return this.goalBag.getItems();
  }

  getQuestions(): TaskData[] {
    return this.questionBag.getItems();
  }

  boost(amount: number): void {
    this.activation = Math.min(1, this.activation + amount);
  }

  decay(rate: number): void {
    this._priority *= (1 - rate);
  }

  boost(amount: number): void {
    this._priority = Math.min(1, this._priority + amount);
  }
}
