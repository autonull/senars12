import type {Term, Truth} from '../terms';
import {extractSymbols, jaccardSimilarity, TermMap, termsEqual, TermSet} from '../terms';
import {Bag} from './bag.js';
import {Truth as TruthOps} from '../terms/truth.js';
import type {Budget, TaskType} from '../types';
import {LINK, THRESHOLDS} from '../constants.js';
import {clamp01} from '../utils/index.js';

const {DECAY_TIME_CONSTANT} = THRESHOLDS;
const {DECAY_RATE, MIN_PRIORITY: MIN_LINK_STRENGTH} = LINK;
const {MERGE: MERGE_SIMILARITY_THRESHOLD} = THRESHOLDS;

export interface TaskData {
    readonly term: Term;
    readonly truth?: Truth;
    readonly budget: Budget;
    readonly timestamp?: number;
    readonly stamp?: import('../terms/stamp.js').Stamp;
    readonly occurrenceTime?: number;
    readonly derived?: boolean;
}

export type ConceptTaskType = TaskType;

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
    private linkedConcepts = new TermMap<ConceptLink>();
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

    get key(): Term {
        return this.term;
    }

    get activationValue(): number {
        return this.activation;
    }

    get totalTasks(): number {
        return this.beliefBag.size + this.goalBag.size + this.questionBag.size;
    }

    addTask(type: ConceptTaskType, data: TaskData): boolean {
        if (type === 'belief') return this.addBeliefWithRevision(data);

        const bag = type === 'goal' ? this.goalBag : this.questionBag;
        const added = bag.add(data, data.budget.priority);
        added && this.recordAccess();
        return added;
    }

    hasMatchingBelief(term: Term): boolean {
        return this.findMatchingBelief(term) !== undefined;
    }

    getBeliefs(): TaskData[] {
        return this.beliefBag.toArray();
    }

    getGoals(): TaskData[] {
        return this.goalBag.toArray();
    }

    getQuestions(): TaskData[] {
        return this.questionBag.toArray();
    }

    boost(amount: number): void {
        this.activation = Math.min(1, this.activation + amount);
        this._priority = Math.min(1, this._priority + amount);
    }

    decay(rate: number): void {
        this._priority *= 1 - rate;
    }

    applyTimeDecay(baseRate = 0.01): void {
        const elapsed = Date.now() - this.lastDecayTime;
        const decayFactor = Math.exp(-baseRate * elapsed / DECAY_TIME_CONSTANT);
        this.activation *= decayFactor;
        this._priority = Math.max(0, this._priority * decayFactor);
        if (this._priority > 0 && elapsed < 1) {
            this._priority = Math.max(0, this._priority * (1 - baseRate));
        }
        this.lastDecayTime = Date.now();
    }

    addLink(concept: Concept, strength = 0.5): void {
        if (concept === this) return;

        const update = (target: Concept, source: Concept) => {
            const existing = target.linkedConcepts.get(source.term);
            if (existing) {
                existing.strength = clamp01(existing.strength + strength * 0.1);
                existing.lastUpdated = Date.now();
            } else {
                target.linkedConcepts.set(source.term, {concept: source, strength, lastUpdated: Date.now()});
            }
        };

        update(this, concept);
        update(concept, this);
    }

    removeLink(concept: Concept): void {
        this.linkedConcepts.delete(concept.term);
        concept.linkedConcepts.delete(this.term);
    }

    getLinks(): ConceptLink[] {
        return Array.from(this.linkedConcepts.values());
    }

    // Deprecated: use getLinks() instead
    getLinkedConcepts(): Concept[] {
        return Array.from(this.linkedConcepts.values()).map(link => link.concept);
    }

    updateLinks(): void {
        const now = Date.now();

        for (const [key, link] of this.linkedConcepts.items()) {
            const elapsed = now - link.lastUpdated;
            link.strength *= Math.exp(-DECAY_RATE * elapsed / DECAY_TIME_CONSTANT);
            if (link.strength < MIN_LINK_STRENGTH) this.linkedConcepts.delete(key);
        }
    }

    canMergeWith(other: Concept, threshold = MERGE_SIMILARITY_THRESHOLD): boolean {
        return this !== other && (
            this.calculateTermSimilarity(other.term) >= threshold ||
            this.calculateTaskOverlap(other) >= threshold
        );
    }

    mergeWith(others: Concept[]): ConceptMergeResult {
        for (const other of [this, ...others]) {
            other.getBeliefs().forEach(belief => this.beliefBag.add(belief, belief.budget.priority));
            other.getGoals().forEach(goal => this.goalBag.add(goal, goal.budget.priority));
            other.getQuestions().forEach(question => this.questionBag.add(question, question.budget.priority));
        }

        for (const other of others) {
            for (const link of other.getLinks()) {
                if (link.concept !== this) this.addLink(link.concept, link.strength);
            }
        }

        this.priority = Math.max(this.priority, ...others.map(c => c.priority));
        return {merged: this, discarded: others};
    }

    split(): Concept[] {
        if (this.subConcepts.size === 0) return [this];
        return [...this.subConcepts];
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

    private recordAccess(): void {
        this.useCount++;
        this.lastAccessedAt = Date.now();
        this._priority = Math.min(1, this._priority + 0.1);
    }

    private addBeliefWithRevision(data: TaskData): boolean {
        const existing = this.findMatchingBelief(data.term);

        if (existing) {
            if (!data.truth || !existing.truth) return false;
            const revisedTruth = TruthOps.revision(data.truth, existing.truth);
            this.beliefBag.remove(existing);
            const added = this.beliefBag.add({
                ...data,
                truth: revisedTruth,
                timestamp: Date.now()
            }, data.budget.priority);
            added && this.recordAccess();
            return added;
        }

        const added = this.beliefBag.add(data, data.budget.priority);
        added && this.recordAccess();
        return added;
    }

    private findMatchingBelief(term: Term): TaskData | undefined {
        return this.beliefBag.toArray().find(item => termsEqual(item.term, term));
    }

    private calculateTermSimilarity(other: Term): number {
        return termsEqual(this.term, other) ? 1 : jaccardSimilarity(extractSymbols(this.term), extractSymbols(other));
    }

    private calculateTaskOverlap(other: Concept): number {
        const thisSet = new TermSet();
        const otherSet = new TermSet();

        this.getBeliefs().forEach(b => thisSet.add(b.term));
        other.getBeliefs().forEach(b => otherSet.add(b.term));

        if (thisSet.size === 0 && otherSet.size === 0) return 0;

        let intersection = 0;
        thisSet.forEach(term => {
            if (otherSet.has(term)) intersection++;
        });

        const union = thisSet.size + otherSet.size - intersection;
        return union > 0 ? intersection / union : 0;
    }
}

interface ConceptConfig {
    maxBeliefs?: number;
    maxGoals?: number;
    maxQuestions?: number;
}
