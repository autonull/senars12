import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import { selectTopN } from '@senars/util';
import type { SamplingStrategy } from '../types.js';

export class TopNSampling implements SamplingStrategy {
  readonly metadata = { name: 'top-n', description: 'Take the N highest-priority concepts' };

  sample(memory: MemoryView, count: number): Concept[] {
    return selectTopN(memory.conceptValues(), count, (c) => c.priority);
  }
}
