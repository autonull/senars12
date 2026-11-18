import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { SamplingStrategy } from '../types.js';
import { rankedSample } from './scored.js';

export class NoveltySampling implements SamplingStrategy {
  readonly metadata = {
    name: 'novelty',
    description: 'Bias toward least-recently-accessed concepts',
  };

  sample(memory: MemoryView, count: number): Concept[] {
    return rankedSample(memory.conceptValues(), count, (c) => -(c.lastAccessedAt ?? 0));
  }
}
