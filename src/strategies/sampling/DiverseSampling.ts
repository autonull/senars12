import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { SamplingStrategy } from '../types';
import { stratifiedSample } from './scored';

export class DiverseSampling implements SamplingStrategy {
  readonly metadata = { name: 'diverse', description: 'Stratified sample across priority bands' };

  sample(memory: MemoryView, count: number): Concept[] {
    return stratifiedSample(memory.conceptValues(), count, (c) => c.priority);
  }
}
