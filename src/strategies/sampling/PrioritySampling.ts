import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { SamplingStrategy } from '../types';
import { Strategy } from '../base';

export class PrioritySampling extends Strategy implements SamplingStrategy {
  constructor() {
    super('priority', 'Priority-weighted sampling (current default)');
  }

  sample(memory: MemoryView, count: number): Concept[] {
    return memory.topConcepts(count);
  }
}