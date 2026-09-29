import { sortBy } from '@senars/util';

import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { SamplingStrategy } from '../types.js';

export class NoveltySampling implements SamplingStrategy {
  readonly metadata = {
    name: 'novelty',
    description: 'Bias toward least-recently-accessed concepts',
  };

  sample(memory: MemoryView, count: number): Concept[] {
    return sortBy(memory.listConcepts(), (c) => c.lastAccessedAt ?? 0).slice(0, count);
  }
}
