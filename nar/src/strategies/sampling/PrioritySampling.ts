import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { SamplingStrategy } from '../types.js';

export class PrioritySampling implements SamplingStrategy {
  readonly metadata = {
    name: 'priority',
    description: 'Priority-weighted sampling (current default)',
  };

  sample(memory: MemoryView, count: number): Concept[] {
    return memory.topConcepts(count);
  }
}
