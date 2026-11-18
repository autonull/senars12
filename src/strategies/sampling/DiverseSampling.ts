import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { SamplingStrategy } from '../types.js';
import { stratifiedSample } from './scored.js';

export class DiverseSampling implements SamplingStrategy {
  readonly metadata = { name: 'diverse', description: 'Stratified sample across priority bands' };

  sample(memory: MemoryView, count: number): Concept[] {
    return stratifiedSample(memory.conceptValues(), count, (c) => c.priority);
  }
}
