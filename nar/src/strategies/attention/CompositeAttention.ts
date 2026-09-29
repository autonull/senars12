import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import { ConfigurationError } from '../../types';
import type { AttentionContext, AttentionModel } from '../types.js';

export interface WeightedAttention {
  model: AttentionModel;
  weight: number;
}

/**
 * A weighted *mean* of its members, not a sum.
 *
 * The members are alternative sources of the same boost — three models that each
 * return "how hard should this concept be primed" — so accumulating them would
 * make the attention slot's magnitude a function of how many names the user
 * listed. Normalizing makes `weight` a ratio, which is what "config-driven
 * attention" needs: `{ simple: 1, 'goal-relevance': 3 }` reads as three parts
 * goal-relevance to one part simple, and the composite still primes in the same
 * range as any single member.
 */
export class CompositeAttention implements AttentionModel {
  readonly metadata = {
    name: 'composite',
    description: 'Weighted mean of several attention models',
  };

  private readonly members: WeightedAttention[];
  private readonly totalWeight: number;

  constructor(models: WeightedAttention[]) {
    if (models.length === 0) {
      throw new ConfigurationError('CompositeAttention needs at least one model');
    }
    const total = models.reduce((sum, m) => sum + m.weight, 0);
    if (!(total > 0)) {
      throw new ConfigurationError('CompositeAttention needs at least one positive weight');
    }
    this.members = models;
    this.totalWeight = total;
  }

  prime(concept: Concept, ctx: AttentionContext): number {
    return this.#weighted((model) => model.prime(concept, ctx));
  }

  decay(concept: Concept, cycles: number, rate: number): number {
    return this.#weighted((model) => model.decay(concept, cycles, rate));
  }

  tick(memory: MemoryView, cycleCount: number): void {
    for (const { model } of this.members) model.tick(memory, cycleCount);
  }

  #weighted(read: (model: AttentionModel) => number): number {
    return this.members.reduce((sum, m) => sum + read(m.model) * m.weight, 0) / this.totalWeight;
  }
}
