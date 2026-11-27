import { rankedSample } from './scored';
import { Strategy } from '../base';
export class NoveltySampling extends Strategy {
    constructor() {
        super('novelty', 'Bias toward least-recently-accessed concepts');
    }
    sample(memory, count) {
        return rankedSample(memory.conceptValues(), count, (c) => -(c.lastAccessedAt ?? 0));
    }
}
