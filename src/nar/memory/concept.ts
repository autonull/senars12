/**
 * Concept class for memory storage
 */

import type {Term} from '../terms';
import type {Truth} from '../terms';
import {Bag} from './bag.js';

export type ConceptTaskType = 'belief' | 'goal' | 'question' | 'command';

interface TaskData {
    readonly term: Term;
    readonly truth?: Truth;
    readonly budget: number;
}

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
    private activation = 0;
    private useCount = 0;
    private lastAccessed: number;

    constructor(term: Term, config: ConceptConfig = {}) {
        this.term = term;
        this.beliefBag = new Bag(config.maxBeliefs ?? 100);
        this.goalBag = new Bag(config.maxGoals ?? 50);
        this.questionBag = new Bag(config.maxQuestions ?? 20);
        this.createdAt = Date.now();
        this.lastAccessed = Date.now();
    }

    get key(): number {
        return this.term.hash;
    }

    get priority(): number {
        return this.activation;
    }

    get totalTasks(): number {
        return this.beliefBag.size + this.goalBag.size + this.questionBag.size;
    }

    addTask(type: ConceptTaskType, data: TaskData): boolean {
        const bag = type === 'belief' ? this.beliefBag : type === 'goal' ? this.goalBag : this.questionBag;
        const added = bag.add(data, data.budget);
        if (added) {
            this.useCount++;
            this.lastAccessed = Date.now();
            this.activation += 0.1;
        }
        return added;
    }

    boost(amount: number): void {
        this.activation = Math.min(1, this.activation + amount);
    }

    decay(rate: number): void {
        this.activation *= (1 - rate);
    }
}
