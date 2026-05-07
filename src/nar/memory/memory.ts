/**
 * Memory system for storing and managing concepts
 */

import {Concept, type ConceptTaskType} from './concept.js';
import type {Term} from '../terms';
import type {Truth} from '../terms';
import type {Budget} from '../types';
import {type CoreConfig, getBudgetValue} from '../types';

export interface MemoryConfig extends Pick<CoreConfig, 'maxConcepts' | 'priorityThreshold' | 'activationDecayRate' | 'consolidationInterval'> {
}

const DEFAULT_CONFIG: MemoryConfig = {
    maxConcepts: 1000,
    priorityThreshold: 0.5,
    activationDecayRate: 0.01,
    consolidationInterval: 10
};

export class Memory {
    private readonly concepts = new Map<number, Concept>();
    private readonly focusConcepts = new Set<number>();
    private readonly config: MemoryConfig;
    private cyclesSinceConsolidation = 0;

    constructor(config: MemoryConfig = DEFAULT_CONFIG) {
        this.config = config;
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
        return concept;
    }

    addTask(term: Term, type: ConceptTaskType, truth?: Truth, budget: Budget | number = 0.9): boolean {
        const concept = this.getConcept(term) ?? this.addConcept(term);
        return concept.addTask(type, {term, truth, budget: getBudgetValue(budget)});
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
        const result: Concept[] = [];
        for (const hash of this.focusConcepts) {
            const concept = this.concepts.get(hash);
            if (concept) result.push(concept);
        }
        return result;
    }

    sample(limit: number): Concept[] {
        const sorted = Array.from(this.concepts.values()).toSorted(
            (a, b) => b.priority - a.priority
        );
        return sorted.slice(0, limit);
    }

    consolidate(): void {
        if (++this.cyclesSinceConsolidation < this.config.consolidationInterval) return;
        this.cyclesSinceConsolidation = 0;

        const {activationDecayRate, priorityThreshold} = this.config;

        for (const concept of this.concepts.values()) {
            concept.decay(activationDecayRate);
        }

        for (const [hash, concept] of this.concepts) {
            if (concept.priority < priorityThreshold && concept.totalTasks === 0) {
                this.concepts.delete(hash);
            }
        }

        this.updateFocus();
    }

    private applyForgetting(): void {
        let lowest: Concept | undefined;
        let lowestPriority = Infinity;

        for (const concept of this.concepts.values()) {
            if (concept.priority < lowestPriority) {
                lowestPriority = concept.priority;
                lowest = concept;
            }
        }

        if (lowest) this.removeConcept(lowest.term);
    }

    private updateFocus(): void {
        this.focusConcepts.clear();
        const {priorityThreshold} = this.config;

        for (const [hash, concept] of this.concepts) {
            if (concept.priority >= priorityThreshold) {
                this.focusConcepts.add(hash);
            }
        }
    }
}
