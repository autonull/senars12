import type {Concept} from './concept.js';

export interface FocusConfig {
    maxConcepts: number;
    attentionThreshold: number;
}

const DEFAULT_CONFIG: FocusConfig = {
    maxConcepts: 50,
    attentionThreshold: 0.3
};

interface FocusEntry {
    concept: Concept;
    priority: number;
}

export class Focus {
    private concepts: FocusEntry[];
    private config: FocusConfig;

    constructor(config: FocusConfig = DEFAULT_CONFIG) {
        this.config = config;
        this.concepts = [];
    }

    get size(): number {
        return this.concepts.length;
    }

    get capacity(): number {
        return this.config.maxConcepts;
    }

    addToFocus(concept: Concept): void {
        const priority = concept.priority;
        if (priority >= this.config.attentionThreshold) {
            const existing = this.concepts.find(c => c.concept.term.hash === concept.term.hash);
            if (existing) {
                existing.priority = priority;
            } else {
                if (this.concepts.length >= this.config.maxConcepts) {
                    this.concepts.shift();
                }
                this.concepts.push({concept, priority});
            }
        }
    }

    removeFromFocus(concept: Concept): boolean {
        const index = this.concepts.findIndex(c => c.concept.term.hash === concept.term.hash);
        if (index !== -1) {
            this.concepts.splice(index, 1);
            return true;
        }
        return false;
    }

    getFocusSet(): Concept[] {
        return this.concepts.map(c => c.concept);
    }

    clearFocus(): void {
        this.concepts = [];
    }

    adjustAttention(concept: Concept, delta: number): void {
        const entry = this.concepts.find(c => c.concept.term.hash === concept.term.hash);
        if (entry) {
            entry.priority = Math.max(0, Math.min(1, entry.priority + delta));
            if (entry.priority < this.config.attentionThreshold) {
                this.removeFromFocus(concept);
            }
        }
    }
}


