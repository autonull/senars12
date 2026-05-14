import type {Concept} from './concept.js';
import {TermMap} from '../terms/term-map.js';

export interface FocusConfig {
    maxConcepts: number;
    attentionThreshold: number;
}

const DEFAULT_CONFIG: FocusConfig = {
    maxConcepts: 50,
    attentionThreshold: 0.3
};

export class Focus {
    private concepts: TermMap<{ concept: Concept; priority: number }> = new TermMap();
    private config: FocusConfig;

    constructor(config: FocusConfig = DEFAULT_CONFIG) {
        this.config = config;
    }

    get size(): number {
        return this.concepts.size;
    }

    get capacity(): number {
        return this.config.maxConcepts;
    }

    addToFocus(concept: Concept): void {
        if (concept.priority < this.config.attentionThreshold) return;

        if (this.concepts.size >= this.config.maxConcepts && !this.concepts.has(concept.term)) {
            const oldest = this.concepts.keys().next();
            if (oldest) {
                this.concepts.delete(oldest.value);
            }
        }
        this.concepts.set(concept.term, {concept, priority: concept.priority});
    }

    removeFromFocus(concept: Concept): boolean {
        return this.concepts.delete(concept.term);
    }

    getFocusSet(): Concept[] {
        const result: Concept[] = [];
        for (const entry of this.concepts.values()) {
            result.push(entry.concept);
        }
        return result;
    }

    clearFocus(): void {
        this.concepts.clear();
    }

    adjustAttention(concept: Concept, delta: number): void {
        const entry = this.concepts.get(concept.term);
        if (!entry) return;

        entry.priority = Math.max(0, Math.min(1, entry.priority + delta));
        if (entry.priority < this.config.attentionThreshold) this.removeFromFocus(concept);
    }
}
