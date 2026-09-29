import { selectTopN } from '@senars/util';

import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import { termKey } from '../../terms';
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
    const strongest = new Map<string, Concept>();
    for (const sampler of this.samplers) {
      for (const concept of sampler.sample(memory, count)) {
        const key = termKey(concept.term);
        const held = strongest.get(key);
        if (!held || concept.priority > held.priority) strongest.set(key, concept);
      }
    }
    return selectTopN(strongest.values(), count, (concept) => concept.priority);
  }
}
