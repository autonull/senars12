import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { SamplingStrategy } from '../types';

export class PrioritySampling implements SamplingStrategy {
  readonly metadata = {
    name: 'priority',
    description: 'Priority-weighted sampling (current default)',
  };

  sample(memory: MemoryView, count: number): Concept[] {
    return memory.topConcepts(count);
  }
}
