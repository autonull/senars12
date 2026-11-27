import { createCappedUnionByTerm } from '../composite';
import { ConfigurableStrategy } from '../base';
/**
 * Union of several sampling strategies: each proposes `count` concepts, the
 * union is deduped by term identity and the highest-priority claim per term
 * wins, then the whole union is cut back to `count`.
 */
export class CompositeSampling extends ConfigurableStrategy {
    constructor(samplers) {
        super('composite', 'Union of several sampling strategies', { samplers });
    }
    sample(memory, count) {
        if (count <= 0)
            return [];
        const composables = this.config.samplers.map((sampler) => ({
            metadata: { name: sampler.metadata.name, description: sampler.metadata.description },
            execute([mem, cnt]) {
                if (cnt <= 0)
                    return [];
                return sampler.sample(mem, cnt);
            },
        }));
        const composite = createCappedUnionByTerm(composables, (c) => c.priority, count, { name: 'composite', description: 'Capped union of sampling strategies' });
        return composite.execute([memory, count]);
    }
}
