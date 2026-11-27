import { Strategy } from '../base';
export class PrioritySampling extends Strategy {
    constructor() {
        super('priority', 'Priority-weighted sampling (current default)');
    }
    sample(memory, count) {
        return memory.topConcepts(count);
    }
}
