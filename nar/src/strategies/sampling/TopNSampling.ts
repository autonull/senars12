import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { SamplingStrategy } from '../types.js';
import { rankedSample } from './scored.js';

export class TopNSampling implements SamplingStrategy {
  readonly metadata = { name: 'top-n', description: 'Take the N highest-priority concepts' };

  sample(memory: MemoryView, count: number): Concept[] {
    return rankedSample(memory.conceptValues(), count, (c) => c.priority);
  }
}
