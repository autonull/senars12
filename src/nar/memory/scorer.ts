import type {Concept} from './concept.js';

export interface ScorerConfig {
    noveltyWeight: number;
    relevanceWeight: number;
    activationWeight: number;
    recencyWeight: number;
}

const DEFAULT_CONFIG: ScorerConfig = {
    noveltyWeight: 0.3,
    relevanceWeight: 0.3,
    activationWeight: 0.2,
    recencyWeight: 0.2
};

export class MemoryScorer {
    private config: ScorerConfig;

    constructor(config: ScorerConfig = DEFAULT_CONFIG) {
        this.config = config;
    }

    score(concept: Concept, context: {
        lastAccessTime?: number;
        relatedConcepts?: number;
        activation?: number;
        recency?: number;
    } = {}): number {
        const novelty = this.computeNovelty(concept, context);
        const relevance = this.computeRelevance(concept, context);
        const activation = context.activation ?? concept.priority;
        const recency = context.recency ?? 1;

        const score =
            novelty * this.config.noveltyWeight +
            relevance * this.config.relevanceWeight +
            activation * this.config.activationWeight +
            recency * this.config.recencyWeight;

        return Math.max(0, Math.min(1, score));
    }

    scoreForRetrieval(concept: Concept, _query?: any): number {
        return this.score(concept, {
            activation: concept.priority,
            recency: 1
        });
    }

    scoreForConsolidation(concept: Concept): number {
        return this.score(concept, {
            activation: concept.priority * 0.5,
            recency: 0.5
        });
    }

    scoreForForgetting(concept: Concept): number {
        return this.score(concept, {
            activation: concept.priority * 0.3,
            recency: 0.3
        });
    }

    private computeNovelty(concept: Concept, context: { relatedConcepts?: number }): number {
        const related = context.relatedConcepts ?? 0;
        return related === 0 ? 1 : 1 / (related + 1);
    }

    private computeRelevance(concept: Concept, context: { relatedConcepts?: number }): number {
        const related = context.relatedConcepts ?? 0;
        return Math.min(1, related / 10);
    }
}


