/**
 * Concept class for memory storage with belief revision and deduplication
 */

import type {Term, Truth} from '../terms';
import {termsEqual} from '../terms/accessors.js';
import {Bag} from './bag.js';
import {Truth as TruthOps} from '../terms/truth.js';
import {extractSymbols} from '../terms/utils.js';

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

export interface ConceptLink {
    concept: Concept;
    strength: number;
    lastUpdated: number;
}

export interface ConceptMergeResult {
    merged: Concept;
    discarded: Concept[];
}

export class Concept {
  readonly term: Term;
  readonly beliefBag: Bag<TaskData>;
  readonly goalBag: Bag<TaskData>;
  readonly questionBag: Bag<TaskData>;
  readonly createdAt: number;
  lastAccessedAt: number;
  private activation = 0;
  private useCount = 0;
  private lastDecayTime: number;
  private linkedConcepts = new Map<number, ConceptLink>();
  private subConcepts = new Set<Concept>();
  private parentConcepts = new Set<Concept>();

  constructor(term: Term, config: ConceptConfig = {}) {
    this.term = term;
    this.beliefBag = new Bag(config.maxBeliefs ?? 100);
    this.goalBag = new Bag(config.maxGoals ?? 50);
    this.questionBag = new Bag(config.maxQuestions ?? 20);
    this.createdAt = Date.now();
    this.lastAccessedAt = Date.now();
    this.lastDecayTime = Date.now();
  }

    private _priority = 0;

    get priority(): number {
        return this._priority;
    }

    set priority(value: number) {
        this._priority = Math.max(0, Math.min(1, value));
    }

    get key(): number {
        return this.term.hash;
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
      this.lastAccessedAt = Date.now();
      this._priority = Math.min(1, this._priority + 0.1);
    }
    return added;
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
        this._priority = Math.min(1, this._priority + amount);
    }

    decay(rate: number): void {
        this._priority *= 1 - rate;
    }

    applyTimeDecay(baseRate = 0.01): void {
        const now = Date.now();
        const elapsed = now - this.lastDecayTime;
        const decayFactor = Math.exp(-baseRate * elapsed / 60000);
        this.activation *= decayFactor;
        this._priority *= decayFactor;
        this.lastDecayTime = now;
    }

    addLink(concept: Concept, strength: number = 0.5): void {
        if (concept === this) return;

        const existing = this.linkedConcepts.get(concept.key);
        if (existing) {
            existing.strength = Math.min(1, existing.strength + strength * 0.1);
            existing.lastUpdated = Date.now();
        } else {
            this.linkedConcepts.set(concept.key, {
                concept,
                strength,
                lastUpdated: Date.now(),
            });
        }

        const reverseLink = concept.linkedConcepts.get(this.key);
        if (reverseLink) {
            reverseLink.strength = Math.min(1, reverseLink.strength + strength * 0.1);
            reverseLink.lastUpdated = Date.now();
        } else {
            concept.linkedConcepts.set(this.key, {
                concept: this,
                strength,
                lastUpdated: Date.now(),
            });
        }
    }

    removeLink(concept: Concept): void {
        this.linkedConcepts.delete(concept.key);
        concept.linkedConcepts.delete(this.key);
    }

    getLinks(): ConceptLink[] {
        return Array.from(this.linkedConcepts.values());
    }

    getLinkedConcepts(): Concept[] {
        return Array.from(this.linkedConcepts.values()).map(link => link.concept);
    }

    updateLinks(): void {
        const now = Date.now();
        const decayRate = 0.001;

        for (const [key, link] of this.linkedConcepts) {
            const elapsed = now - link.lastUpdated;
            link.strength *= Math.exp(-decayRate * elapsed / 60000);
            if (link.strength < 0.01) {
                this.linkedConcepts.delete(key);
            }
        }
    }

    canMergeWith(other: Concept, threshold = 0.85): boolean {
        if (this === other) return false;

        const termSimilarity = this.calculateTermSimilarity(other.term);
        const taskOverlap = this.calculateTaskOverlap(other);

        return termSimilarity >= threshold || taskOverlap >= threshold;
    }

    mergeWith(others: Concept[]): ConceptMergeResult {
        const allConcepts = [this, ...others];
        const allBeliefs: TaskData[] = [];
        const allGoals: TaskData[] = [];
        const allQuestions: TaskData[] = [];

        for (const concept of allConcepts) {
            allBeliefs.push(...concept.getBeliefs());
            allGoals.push(...concept.getGoals());
            allQuestions.push(...concept.getQuestions());
        }

        for (const belief of allBeliefs) {
            this.beliefBag.add(belief, belief.budget);
        }
        for (const goal of allGoals) {
            this.goalBag.add(goal, goal.budget);
        }
        for (const question of allQuestions) {
            this.questionBag.add(question, question.budget);
        }

        for (const other of others) {
            for (const link of other.getLinks()) {
                if (link.concept !== this) {
                    this.addLink(link.concept, link.strength);
                }
            }
        }

        const maxPriority = Math.max(this.priority, ...others.map(c => c.priority));
        this.priority = maxPriority;

        return {
            merged: this,
            discarded: others,
        };
    }

    split(): Concept[] {
        if (this.subConcepts.size === 0) {
            return [this];
        }

        const result: Concept[] = [];
        const processed = new Set<Concept>();

        for (const sub of this.subConcepts) {
            if (!processed.has(sub)) {
                result.push(sub);
                processed.add(sub);
            }
        }

        if (result.length === 0) {
            return [this];
        }

        return result;
    }

    addChildConcept(concept: Concept): void {
        this.subConcepts.add(concept);
        concept.parentConcepts.add(this);
    }

    removeChildConcept(concept: Concept): void {
        this.subConcepts.delete(concept);
        concept.parentConcepts.delete(this);
    }

    getChildConcepts(): Concept[] {
        return Array.from(this.subConcepts);
    }

    getParentConcepts(): Concept[] {
        return Array.from(this.parentConcepts);
    }

    private addBeliefWithRevision(data: TaskData): boolean {
        const existing = this.findMatchingBelief(data.term);

        if (existing) {
            if (data.truth && existing.truth) {
                const revisedTruth = TruthOps.revision(data.truth, existing.truth);
                const revisedData = {...data, truth: revisedTruth, timestamp: Date.now()};
    this.beliefBag.remove(existing);
    const added = this.beliefBag.add(revisedData, revisedData.budget);
    if (added) {
      this.useCount++;
      this.lastAccessedAt = Date.now();
      this._priority = Math.min(1, this._priority + 0.1);
    }
    return added;
            }
            return false;
        }

    const added = this.beliefBag.add(data, data.budget);
    if (added) {
      this.useCount++;
      this.lastAccessedAt = Date.now();
      this._priority = Math.min(1, this._priority + 0.1);
    }
    return added;
    }

    private findMatchingBelief(term: Term): TaskData | undefined {
        const items = this.beliefBag.getItems();
        for (const item of items) {
            if (termsEqual(item.term, term)) {
                return item;
            }
        }
        return undefined;
    }

private calculateTermSimilarity(other: Term): number {
  if (termsEqual(this.term, other)) return 1;

  const thisSymbols = extractSymbols(this.term);
  const otherSymbols = extractSymbols(other);

        const intersection = new Set([...thisSymbols].filter(s => otherSymbols.has(s)));
        const union = new Set([...thisSymbols, ...otherSymbols]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }

    private calculateTaskOverlap(other: Concept): number {
        const thisBeliefs = new Set(this.getBeliefs().map(b => b.term.hash));
        const otherBeliefs = new Set(other.getBeliefs().map(b => b.term.hash));

        if (thisBeliefs.size === 0 && otherBeliefs.size === 0) return 0;

        const intersection = new Set([...thisBeliefs].filter(h => otherBeliefs.has(h)));
        const union = new Set([...thisBeliefs, ...otherBeliefs]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }


}
