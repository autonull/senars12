import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { SamplingStrategy } from '../types';
import { rankedSample } from './scored';
import { Strategy } from '../base';

export class NoveltySampling extends Strategy implements SamplingStrategy {
  constructor() {
    super('novelty', 'Bias toward least-recently-accessed concepts');
  }

  sample(memory: MemoryView, count: number): Concept[] {
    return rankedSample(memory.conceptValues(), count, (c) => -(c.lastAccessedAt ?? 0));
  }
}