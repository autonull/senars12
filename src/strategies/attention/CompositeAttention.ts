import { safeRatio, sumBy } from '@senars/util/numeric';
import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import { ConfigurationError } from '../../types';
import type { AttentionContext, AttentionModel } from '../types';
import { createWeightedMeanComposite, type Composable } from '../composite';

export interface WeightedAttention {
  model: AttentionModel;
  weight: number;
}

/**
 * A composite attention model using the generic weighted-mean composite
 * for `prime` and `decay`, and delegating `tick` to all members.
 */
export class CompositeAttention implements AttentionModel {
  readonly metadata = {
    name: 'composite',
    description: 'Weighted mean of several attention models',
  };

  private readonly primeComposite: Composable<[Concept, AttentionContext], number>;
  private readonly decayComposite: Composable<[Concept, number, number], number>;
  private readonly members: AttentionModel[];

  constructor(models: WeightedAttention[]) {
    if (models.length === 0) {
      throw new ConfigurationError('CompositeAttention needs at least one model');
    }
    const total = sumBy(models, (m) => m.weight);
    if (!(total > 0)) {
      throw new ConfigurationError('CompositeAttention needs at least one positive weight');
    }

    this.members = models.map((m) => m.model);

    // Build weighted-mean composites for prime and decay
    const weightedMembers: Array<Composable<[Concept, AttentionContext], number> & { weight: number }> =
      models.map((m) => ({
        weight: m.weight,
        execute: ([concept, ctx]) => m.model.prime(concept, ctx),
        metadata: { name: m.model.metadata?.name ?? 'unknown', description: m.model.metadata?.description ?? '' },
      }));

    const weightedDecayMembers: Array<Composable<[Concept, number, number], number> & { weight: number }> =
      models.map((m) => ({
        weight: m.weight,
        execute: ([concept, cycles, rate]) => m.model.decay(concept, cycles, rate),
        metadata: { name: m.model.metadata?.name ?? 'unknown', description: m.model.metadata?.description ?? '' },
      }));

    this.primeComposite = createWeightedMeanComposite(
      weightedMembers,
      { name: 'composite-prime', description: 'Weighted mean of attention prime' }
    );

    this.decayComposite = createWeightedMeanComposite(
      weightedDecayMembers,
      { name: 'composite-decay', description: 'Weighted mean of attention decay' }
    );
  }

  prime(concept: Concept, ctx: AttentionContext): number {
    return this.primeComposite.execute([concept, ctx]);
  }

  decay(concept: Concept, cycles: number, rate: number): number {
    return this.decayComposite.execute([concept, cycles, rate]);
  }

  tick(memory: MemoryView, cycleCount: number): void {
    for (const model of this.members) model.tick(memory, cycleCount);
  }
}
