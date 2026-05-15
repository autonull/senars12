import type {Term, Truth} from '../terms';
import type {Budget} from '../types';
import {Concept, type ConceptTaskType, type ConceptMergeResult} from './concept.js';
import {TermMap, calculateSimilarity} from '../terms';
import {Focus} from './focus.js';
import {MemoryIndex} from './memory-index.js';
import {MemoryScorer} from './scorer.js';
import {Forgetting} from './forgetting.js';
import type {ForgettingPolicy} from './forgetting.js';
import type {MemoryConfig} from './memory.js';

export interface MemoryCoreConfig {
    maxConcepts: number;
    priorityThreshold: number;
    enableIndexing: boolean;
    focusMaxConcepts: number;
    focusThreshold: number;
    forgettingPolicy: ForgettingPolicy;
}

export class MemoryCore {
    private readonly concepts = new TermMap<Concept>();
    private readonly config: Required<MemoryCoreConfig>;
    private readonly index: MemoryIndex;
    private readonly focus: Focus;
    private readonly scorer: MemoryScorer;
    private readonly forgetting: Forgetting;

    constructor(config: MemoryCoreConfig, indexConfig: {enableAtomicIndex: boolean; enableTemporalIndex: boolean; enableActivationIndex: boolean}) {
        this.config = config as Required<MemoryCoreConfig>;
        this.index = new MemoryIndex(indexConfig);
        this.focus = new Focus({
            maxConcepts: this.config.focusMaxConcepts,
            attentionThreshold: this.config.focusThreshold,
        });
        this.scorer = new MemoryScorer();
        this.forgetting = new Forgetting(this.config.forgettingPolicy);
    }

    get size(): number {
        return this.concepts.size;
    }

    getConcept(term: Term): Concept | undefined {
        return this.concepts.get(term);
    }

    addConcept(term: Term): Concept {
        const existing = this.concepts.get(term);
        if (existing) return existing;

        if (this.concepts.size >= this.config.maxConcepts) {
            this.applyForgetting();
        }

        const concept = new Concept(term);
        this.concepts.set(term, concept);

        if (this.config.enableIndexing) {
            this.index.index(concept, Date.now());
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
            this.concepts.delete(term);
            return true;
        }
        return false;
    }

    listConcepts(): Concept[] {
        return Array.from(this.concepts.values());
    }

    getFocusConcepts(): Concept[] {
        return this.focus.getFocusSet();
    }

    sample(limit: number): Concept[] {
        const allConcepts = [...this.concepts.values()];
        allConcepts.sort((a, b) => this.scorer.scoreForRetrieval(b) - this.scorer.scoreForRetrieval(a));
        return allConcepts.slice(0, limit);
    }

    clear(): void {
        this.concepts.clear();
        this.focus.clearFocus();
        if (this.config.enableIndexing) {
            this.index.clear();
        }
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
            similarity: calculateSimilarity(concept.term, term),
        }));
        scored.sort((a, b) => b.similarity - a.similarity);
        return scored.slice(0, limit).map(s => s.concept);
    }

    queryBySymbol(symbol: string): Concept[] {
        if (!this.config.enableIndexing) return [];
        return this.index.getByAtomic(symbol);
    }

    queryByTimeRange(start: number, end: number): Concept[] {
        if (!this.config.enableIndexing) return [];
        return this.index.getByTemporal([start, end]);
    }

    getIndex(): MemoryIndex {
        return this.index;
    }

    getFocus(): Focus {
        return this.focus;
    }

    private updateFocus(concept: Concept): void {
        this.focus.addToFocus(concept);
    }

    updateAllFocus(): void {
        this.focus.clearFocus();
        for (const concept of this.concepts.values()) {
            if (concept.priority >= this.config.priorityThreshold) {
                this.focus.addToFocus(concept);
            }
        }
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
}