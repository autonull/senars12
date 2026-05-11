import type {Concept} from './concept.js';
import {termsEqual} from '../terms';

export interface FocusConfig {
    maxConcepts: number;
    attentionThreshold: number;
}

const DEFAULT_CONFIG: FocusConfig = {
    maxConcepts: 50,
    attentionThreshold: 0.3
};

export class Focus {
    private concepts: Map<string, {concept: Concept; priority: number}> = new Map();
    private config: FocusConfig;

    constructor(config: FocusConfig = DEFAULT_CONFIG) {
        this.config = config;
    }

    get size(): number { return this.concepts.size; }
    get capacity(): number { return this.config.maxConcepts; }

    addToFocus(concept: Concept): void {
        if (concept.priority < this.config.attentionThreshold) return;

        const key = concept.term.hash?.toString() ?? concept.term.toString();
        if (this.concepts.size >= this.config.maxConcepts && !this.concepts.has(key)) {
            this.concepts.delete(this.concepts.keys().next().value!);
        }
        this.concepts.set(key, {concept, priority: concept.priority});
    }

    removeFromFocus(concept: Concept): boolean {
        const key = concept.term.hash?.toString() ?? concept.term.toString();
        return this.concepts.delete(key);
    }

    getFocusSet(): Concept[] { return [...this.concepts.values()].map(c => c.concept); }
    clearFocus(): void { this.concepts.clear(); }

    adjustAttention(concept: Concept, delta: number): void {
        const key = concept.term.hash?.toString() ?? concept.term.toString();
        const entry = this.concepts.get(key);
        if (!entry) return;

        entry.priority = Math.max(0, Math.min(1, entry.priority + delta));
        if (entry.priority < this.config.attentionThreshold) this.removeFromFocus(concept);
    }
}


