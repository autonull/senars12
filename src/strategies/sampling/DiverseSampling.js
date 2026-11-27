import { stratifiedSample } from './scored';
import { Strategy } from '../base';
export class DiverseSampling extends Strategy {
    constructor() {
        super('diverse', 'Stratified sample across priority bands');
    }
    sample(memory, count) {
        return stratifiedSample(memory.conceptValues(), count, (c) => c.priority);
    }
}
