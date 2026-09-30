import { clamp01 } from '@senars/util';
import { SATURATION_COUNT } from '../../constants.js';
import type { Concept } from '../concept.js';

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
  recencyWeight: 0.2,
};

type FactorType = 'retrieval' | 'consolidation' | 'forgetting';

// Hoisted: `scoreFor` runs per concept per sample, and a fresh pair of object
// literals per call was the only allocation on an otherwise arithmetic-only path.
const FACTORS: Record<FactorType, { a: number; r: number }> = {
  retrieval: { a: 1, r: 1 },
  consolidation: { a: 0.5, r: 0.5 },
  forgetting: { a: 0.3, r: 0.3 },
};

/** Novelty falls off with the number of concepts already related to the term. */
const noveltyOf = (related: number): number => (related === 0 ? 1 : 1 / (related + 1));

/** Relevance saturates at {@link SATURATION_COUNT} related concepts. */
const relevanceOf = (related: number): number => clamp01(related / SATURATION_COUNT);

/** No context means no related-concept count — the value the two factors take at zero. */
const UNRELATED = 0;

export class MemoryScorer {
  private config: ScorerConfig;

  constructor(config: ScorerConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  score(
    concept: Concept,
    context: {
      lastAccessTime?: number;
      lastAccessedAt?: number;
      relatedConcepts?: number;
      activation?: number;
      recency?: number;
    } = {}
  ): number {
    const related = context.relatedConcepts ?? UNRELATED;
    return this.weigh(
      noveltyOf(related),
      relevanceOf(related),
      context.activation ?? concept.priority,
      context.recency ?? 1
    );
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

  /**
   * The per-concept path: the same four factors `score` weighs, with the
   * activation and recency scaled by the factor pair and no related-concept
   * count to supply. This runs once per concept per inference cycle, so it takes
   * the factors as arguments rather than building the context object `score`
   * reads.
   */
  private scoreFor(type: FactorType, concept: Concept): number {
    const { a, r } = FACTORS[type];
    return this.weigh(noveltyOf(UNRELATED), relevanceOf(UNRELATED), concept.priority * a, r);
  }

  private weigh(novelty: number, relevance: number, activation: number, recency: number): number {
    const { noveltyWeight, relevanceWeight, activationWeight, recencyWeight } = this.config;
    return clamp01(
      novelty * noveltyWeight +
        relevance * relevanceWeight +
        activation * activationWeight +
        recency * recencyWeight
    );
  }
}
