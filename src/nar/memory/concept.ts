import type {Term, Truth} from '../terms';
import {Bag} from './bag.js';
import {Truth as TruthOps} from '../terms/truth.js';
import {jaccard} from '../utils/similarity.js';
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
    readonly lastAccessTime: number;
    private activation = 0;
    private _useCount = 0;
    private _lastAccessed: number;
    private lastDecayTime: number;
    private linkedConcepts = new Map<number, ConceptLink>();
    private subConcepts = new Set<Concept>();
    private parentConcepts = new Set<Concept>();

    private onAdd(): void {
        this._useCount++;
        this._lastAccessed = Date.now();
        this._priority = Math.min(1, this._priority + 0.1);
    }

    constructor(term: Term, config: ConceptConfig = {}) {
        this.term = term;
        this.beliefBag = new Bag(config.maxBeliefs ?? 100);
        this.goalBag = new Bag(config.maxGoals ?? 50);
        this.questionBag = new Bag(config.maxQuestions ?? 20);
        this.createdAt = Date.now();
        this._lastAccessed = Date.now();
        this.lastAccessTime = Date.now();
        this.lastDecayTime = Date.now();
    }

    private _priority = 0;
    get priority(): number { return this._priority; }
    set priority(value: number) { this._priority = Math.max(0, Math.min(1, value)); }
    get key(): number { return this.term.hash; }
    get activationValue(): number { return this.activation; }
    get totalTasks(): number { return this.beliefBag.size + this.goalBag.size + this.questionBag.size; }

    addTask(type: ConceptTaskType, data: TaskData): boolean {
        if (type === 'belief') return this.addBeliefWithRevision(data);
        const bag = type === 'goal' ? this.goalBag : this.questionBag;
        return bag.add(data, data.budget) ? (this.onAdd(), true) : false;
    }

    hasMatchingBelief(term: Term): boolean { return !!this.findMatchingBelief(term); }
    getBeliefs(): TaskData[] { return this.beliefBag.getItems(); }
    getGoals(): TaskData[] { return this.goalBag.getItems(); }
    getQuestions(): TaskData[] { return this.questionBag.getItems(); }

    boost(amount: number): void { this.activation = Math.min(1, this.activation + amount); this._priority = Math.min(1, this._priority + amount); }
    decay(rate: number): void { this._priority *= 1 - rate; }
    applyTimeDecay(baseRate = 0.01): void {
        const elapsed = Date.now() - this.lastDecayTime;
        const factor = Math.exp(-baseRate * elapsed / 60000);
        this.activation *= factor; this._priority *= factor;
        this.lastDecayTime = Date.now();
    }

    addLink(concept: Concept, strength = 0.5): void {
        if (concept === this) return;
        const setLink = (map: Map<number, ConceptLink>, key: number, c: Concept, s: number) => {
            const existing = map.get(key);
            existing ? (existing.strength = Math.min(1, existing.strength + s * 0.1), existing.lastUpdated = Date.now())
                     : map.set(key, {concept: c, strength: s, lastUpdated: Date.now()});
        };
        setLink(this.linkedConcepts, concept.key, concept, strength);
        setLink(concept.linkedConcepts, this.key, this, strength);
    }

    removeLink(concept: Concept): void { this.linkedConcepts.delete(concept.key); concept.linkedConcepts.delete(this.key); }
    getLinks(): ConceptLink[] { return [...this.linkedConcepts.values()]; }
    getLinkedConcepts(): Concept[] { return [...this.linkedConcepts.values()].map(l => l.concept); }

    updateLinks(): void {
        const now = Date.now();
        for (const [key, link] of this.linkedConcepts) {
            link.strength *= Math.exp(-0.001 * (now - link.lastUpdated) / 60000);
            if (link.strength < 0.01) this.linkedConcepts.delete(key);
        }
    }

    canMergeWith(other: Concept, threshold = 0.85): boolean {
        if (this === other) return false;
        const termSim = jaccard(extractSymbols(this.term), extractSymbols(other.term));
        const taskSim = jaccard(new Set(this.getBeliefs().map(b => b.term.hash)), new Set(other.getBeliefs().map(b => b.term.hash)));
        return termSim >= threshold || taskSim >= threshold;
    }

    mergeWith(others: Concept[]): ConceptMergeResult {
        const addAll = (items: TaskData[]) => items.forEach(b => this.beliefBag.add(b, b.budget));
        const addAllGoals = (items: TaskData[]) => items.forEach(g => this.goalBag.add(g, g.budget));
        const addAllQuestions = (items: TaskData[]) => items.forEach(q => this.questionBag.add(q, q.budget));
        addAll(this.getBeliefs()); addAllGoals(this.getGoals()); addAllQuestions(this.getQuestions());
        others.forEach(o => { addAll(o.getBeliefs()); addAllGoals(o.getGoals()); addAllQuestions(o.getQuestions()); });
        others.forEach(o => o.getLinks().forEach(l => l.concept !== this && this.addLink(l.concept, l.strength)));
        this.priority = Math.max(this.priority, ...others.map(c => c.priority));
        return {merged: this, discarded: others};
    }

    split(): Concept[] {
        if (this.subConcepts.size === 0) return [this];
        const result: Concept[] = [];
        const processed = new Set<Concept>();
        for (const sub of this.subConcepts) { if (!processed.has(sub)) { result.push(sub); processed.add(sub); } }
        return result.length === 0 ? [this] : result;
    }

    addChildConcept(concept: Concept): void { this.subConcepts.add(concept); concept.parentConcepts.add(this); }
    removeChildConcept(concept: Concept): void { this.subConcepts.delete(concept); concept.parentConcepts.delete(this); }
    getChildConcepts(): Concept[] { return [...this.subConcepts]; }
    getParentConcepts(): Concept[] { return [...this.parentConcepts]; }

    private addBeliefWithRevision(data: TaskData): boolean {
        const existing = this.findMatchingBelief(data.term);
        if (existing?.truth && data.truth) {
            const revised = {...data, truth: TruthOps.revision(data.truth, existing.truth), timestamp: Date.now()};
            this.beliefBag.remove(existing);
            return this.beliefBag.add(revised, revised.budget) ? (this.onAdd(), true) : false;
        }
        return this.beliefBag.add(data, data.budget) ? (this.onAdd(), true) : false;
    }

    private findMatchingBelief(term: Term): TaskData | undefined {
        return this.beliefBag.getItems().find(b => b.term.hash === term.hash);
    }
}