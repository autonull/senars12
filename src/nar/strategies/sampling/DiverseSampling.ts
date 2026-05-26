import type {Memory, Concept} from '../../memory/index.js';
import type {SamplingStrategy} from '../types.js';

export class DiverseSampling implements SamplingStrategy {
  readonly metadata = { name: 'diverse', description: 'Stratified sample across priority bands' };
  sample(memory: Memory, count: number): Concept[] {
    const concepts = memory.listConcepts();
    const bands = 4;
    const perBand = Math.max(1, Math.ceil(count / bands));
    const sorted = concepts.sort((a, b) => a.priority - b.priority);
    const bandSize = Math.max(1, Math.floor(sorted.length / bands));
    const result: Concept[] = [];
    for (let b = 0; b < bands; b++) {
      const start = b * bandSize;
      const band = sorted.slice(start, start + bandSize);
      result.push(...band.slice(0, perBand));
    }
    return result.slice(0, count);
  }
}
