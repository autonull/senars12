import { selectTopN } from '@senars/util';

import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import { keepStrongestByTerm } from '../premise/primitives.js';
import type { ComponentMetadata, SamplingStrategy } from '../types.js';

/**
 * Union of several sampling strategies: each proposes `count` concepts, the
 * union is deduped by term identity and the highest-priority claim per term
 * wins, then the whole union is cut back to `count`.
 */
export class CompositeSampling implements SamplingStrategy {
  readonly metadata: ComponentMetadata = {
    name: 'composite',
    description: 'Union of several sampling strategies',
  };

  constructor(private readonly samplers: SamplingStrategy[]) {}

  sample(memory: MemoryView, count: number): Concept[] {
    if (count <= 0) return [];
    const candidates = this.samplers.flatMap((sampler) => sampler.sample(memory, count));
    const deduped = keepStrongestByTerm(candidates, (concept) => concept.priority);
    return selectTopN(deduped, count, (concept) => concept.priority);
  }
}
