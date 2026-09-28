import type { Concept, Memory } from '../../memory';
import { selectTopN } from '../../utils/collections.js';
import type { SamplingStrategy } from '../types.js';

export class TopNSampling implements SamplingStrategy {
  readonly metadata = { name: 'top-n', description: 'Take the N highest-priority concepts' };

  sample(memory: Memory, count: number): Concept[] {
    return selectTopN(memory.conceptValues(), count, (c) => c.priority);
  }
}
