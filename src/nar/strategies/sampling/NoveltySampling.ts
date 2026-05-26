import type {Memory, Concept} from '../../memory/index.js';
import type {SamplingStrategy} from '../types.js';

export class NoveltySampling implements SamplingStrategy {
  readonly metadata = { name: 'novelty', description: 'Bias toward least-recently-accessed concepts' };
  sample(memory: Memory, count: number): Concept[] {
    return memory.listConcepts()
      .sort((a, b) => (a.lastAccessedAt ?? 0) - (b.lastAccessedAt ?? 0))
      .slice(0, count);
  }
}
