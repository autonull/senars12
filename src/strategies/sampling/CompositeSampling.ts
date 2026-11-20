import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { ComponentMetadata, SamplingStrategy } from '../types.js';
import { createCappedUnionByTerm, type Composable } from '../composite.js';

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

  private readonly samplers: SamplingStrategy[];

  constructor(samplers: SamplingStrategy[]) {
    this.samplers = samplers;
  }

  sample(memory: MemoryView, count: number): Concept[] {
    if (count <= 0) return [];
    const composables: Composable<[MemoryView, number], Concept[]>[] = this.samplers.map(
      (sampler) => ({
        metadata: { name: sampler.metadata.name, description: sampler.metadata.description },
        execute([mem, cnt]) {
          if (cnt <= 0) return [];
          return sampler.sample(mem, cnt);
        },
      })
    );
    const composite = createCappedUnionByTerm(
      composables,
      (c) => c.priority,
      count,
      { name: 'composite', description: 'Capped union of sampling strategies' }
    );
    return composite.execute([memory, count]);
  }
}
