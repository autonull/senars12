import type { Concept, Memory } from '../../memory';
import type { SamplingStrategy } from '../types.js';

export class TopNSampling implements SamplingStrategy {
  readonly metadata = { name: 'top-n', description: 'Take the N highest-priority concepts' };

  sample(memory: Memory, count: number): Concept[] {
    return memory
      .listConcepts()
      .sort((a, b) => b.priority - a.priority)
      .slice(0, count);
  }
}
