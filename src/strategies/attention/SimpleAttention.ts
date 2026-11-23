import { forget } from '@senars/util/numeric';
import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { AttentionContext, AttentionModel } from '../types';
import { ConfigurableStrategy } from '../base';

export class SimpleAttention extends ConfigurableStrategy<{ boost: number }> implements AttentionModel {
  constructor(boost = 0.3) {
    super('simple', 'Fixed boost on prime, exponential decay', { boost });
  }

  prime(_concept: Concept, _ctx: AttentionContext): number {
    return this.config.boost;
  }

  decay(concept: Concept, _cycles: number, baseDecayRate: number): number {
    return forget(concept.priority, baseDecayRate);
  }

  tick(_memory: MemoryView, _cycleCount: number): void {}
}