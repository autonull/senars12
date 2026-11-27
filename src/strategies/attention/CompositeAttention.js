import { sumBy } from '@senars/util/numeric';
import { ConfigurationError } from '../../types';
import { createWeightedMeanComposite } from '../composite';
import { ConfigurableStrategy } from '../base';
/**
 * A composite attention model using the generic weighted-mean composite
 * for `prime` and `decay`, and delegating `tick` to all members.
 */
export class CompositeAttention extends ConfigurableStrategy {
    primeComposite;
    decayComposite;
    members;
    constructor(models) {
        if (models.length === 0) {
            throw new ConfigurationError('CompositeAttention needs at least one model');
        }
        const total = sumBy(models, (m) => m.weight);
        if (!(total > 0)) {
            throw new ConfigurationError('CompositeAttention needs at least one positive weight');
        }
        const config = { models };
        super('composite', 'Weighted mean of several attention models', config);
        this.members = models.map((m) => m.model);
        // Build weighted-mean composites for prime and decay
        const weightedMembers = models.map((m) => ({
            weight: m.weight,
            execute: ([concept, ctx]) => m.model.prime(concept, ctx),
            metadata: { name: m.model.metadata?.name ?? 'unknown', description: m.model.metadata?.description ?? '' },
        }));
        const weightedDecayMembers = models.map((m) => ({
            weight: m.weight,
            execute: ([concept, cycles, rate]) => m.model.decay(concept, cycles, rate),
            metadata: { name: m.model.metadata?.name ?? 'unknown', description: m.model.metadata?.description ?? '' },
        }));
        this.primeComposite = createWeightedMeanComposite(weightedMembers, { name: 'composite-prime', description: 'Weighted mean of attention prime' });
        this.decayComposite = createWeightedMeanComposite(weightedDecayMembers, { name: 'composite-decay', description: 'Weighted mean of attention decay' });
    }
    prime(concept, ctx) {
        return this.primeComposite.execute([concept, ctx]);
    }
    decay(concept, cycles, rate) {
        return this.decayComposite.execute([concept, cycles, rate]);
    }
    tick(memory, cycleCount) {
        for (const model of this.members)
            model.tick(memory, cycleCount);
    }
}
