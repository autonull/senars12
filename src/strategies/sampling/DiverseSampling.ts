import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { SamplingStrategy } from '../types';
import { stratifiedSample } from './scored';
import { Strategy } from '../base';

export class DiverseSampling extends Strategy implements SamplingStrategy {
  constructor() {
    super('diverse', 'Stratified sample across priority bands');
  }

  sample(memory: MemoryView, count: number): Concept[] {
    return stratifiedSample(memory.conceptValues(), count, (c) => c.priority);
  }
}