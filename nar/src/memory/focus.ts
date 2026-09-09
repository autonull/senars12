import type {AttentionModel} from '../strategies';
import {containsSubterm, TermMap, type Term} from '../terms';
import type {Task} from '../types';
import {clamp01} from '../utils';
import type {Concept} from './concept.js';

export interface FocusConfig {
    maxConcepts: number;
}

const DEFAULT_CONFIG: FocusConfig = {
    maxConcepts: 50,
};

export class Focus {
    private concepts: TermMap<{ concept: Concept; priority: number }> = new TermMap();
    private config: FocusConfig;
    private topicBoosts = new Map<string, { factor: number; ttl: number }>();
    private activeGoals: Task[] = [];

    constructor(
        config: FocusConfig = DEFAULT_CONFIG,
        private readonly attentionModel?: AttentionModel
    ) {
        this.config = config;
    }

    get size(): number {
        return this.concepts.size;
    }

    get capacity(): number {
        return this.config.maxConcepts;
    }

    addToFocus(concept: Concept): void {
        if (this.concepts.size >= this.config.maxConcepts && !this.concepts.has(concept.term)) {
            let lowestKey: Term | undefined;
            let lowestPriority = Infinity;
            for (const [key, entry] of this.concepts) {
                if (entry.priority < lowestPriority) {
                    lowestPriority = entry.priority;
                    lowestKey = key;
                }
            }
            if (lowestKey !== undefined && lowestPriority < concept.priority) {
                this.concepts.delete(lowestKey);
            } else {
                return;
            }
        }
        this.concepts.set(concept.term, {concept, priority: concept.priority});
    }

    removeFromFocus(concept: Concept): boolean {
        return this.concepts.delete(concept.term);
    }

    forEachFocus(fn: (concept: Concept) => void): void {
        for (const entry of this.concepts.values()) {
            fn(entry.concept);
        }
    }

    * focusConcepts(): IterableIterator<Concept> {
        for (const entry of this.concepts.values()) {
            yield entry.concept;
        }
    }

    getFocusSet(): Concept[] {
        const out: Concept[] = [];
        this.forEachFocus((c) => out.push(c));
        return out;
    }

    clearFocus(): void {
        this.concepts.clear();
    }

    adjustAttention(concept: Concept, delta: number): void {
        const entry = this.concepts.get(concept.term);
        if (!entry) return;

        entry.priority = clamp01(entry.priority + delta);
    }

    boostTopic(topic: string, factor = 2.0, ttl = 50): void {
        this.topicBoosts.set(topic.toLowerCase(), {factor, ttl});
    }

    getActiveGoals(): Task[] {
        return [...this.activeGoals];
    }

    setActiveGoals(goals: Task[]): void {
        this.activeGoals = goals;
    }

    adjustPriority(concept: Concept, basePriority: number): number {
        let p = basePriority;

        // Delegate to attention model if available
        if (this.attentionModel) {
            const decay = this.attentionModel.decay(concept, 1, 0.01);
            p -= decay;
        }

        const termStr = concept.term.toString().toLowerCase();

        for (const [topic, boost] of this.topicBoosts) {
            if (termStr.includes(topic)) {
                p *= boost.factor;
                boost.ttl--;
                if (boost.ttl <= 0) this.topicBoosts.delete(topic);
            }
        }

        for (const goal of this.activeGoals) {
            if (containsSubterm(concept.term, goal.term) || containsSubterm(goal.term, concept.term)) {
                p *= 1.5;
            }
        }

        if (concept.lastAccessedAt > Date.now() - 60000) p *= 1.2;

        return Math.min(p, 1.0);
    }

    getTopicBoosts(): Map<string, { factor: number; ttl: number }> {
        return this.topicBoosts;
    }

    clearTopicBoosts(): void {
        this.topicBoosts.clear();
    }
}
