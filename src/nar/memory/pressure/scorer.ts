import type {Concept} from '../concept.js';
import {clamp01} from '../../utils/index.js';

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
        lastAccessedAt?: number;
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

        return clamp01(score);
    }

    scoreForRetrieval(concept: Concept, _query?: Record<string, unknown>): number {
        return this.scoreFor('retrieval', concept);
    }

    scoreForConsolidation(concept: Concept): number {
        return this.scoreFor('consolidation', concept);
    }

    scoreForForgetting(concept: Concept): number {
        return this.scoreFor('forgetting', concept);
    }

    private scoreFor(type: 'retrieval' | 'consolidation' | 'forgetting', concept: Concept): number {
        const factors = {
            retrieval: {a: 1, r: 1},
            consolidation: {a: 0.5, r: 0.5},
            forgetting: {a: 0.3, r: 0.3}
        }[type];
        return this.score(concept, {
            activation: concept.priority * factors.a,
            recency: factors.r
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


