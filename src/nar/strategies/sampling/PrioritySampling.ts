import type {Concept, Memory} from '../../memory/index.js';
import type {SamplingStrategy} from '../types.js';

export class PrioritySampling implements SamplingStrategy {
    readonly metadata = {name: 'priority', description: 'Priority-weighted sampling (current default)'};

    sample(memory: Memory, count: number): Concept[] {
        return memory.sample(count);
    }
}
