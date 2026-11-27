import { forget } from '@senars/util/numeric';
import { ConfigurableStrategy } from '../base';
export class SimpleAttention extends ConfigurableStrategy {
    constructor(boost = 0.3, name = 'simple', description = 'Fixed boost on prime, exponential decay') {
        super(name, description, { boost });
    }
    prime(_concept, _ctx) {
        return this.config.boost;
    }
    decay(concept, _cycles, baseDecayRate) {
        return forget(concept.priority, baseDecayRate);
    }
    tick(_memory, _cycleCount) { }
}
