import { forget } from '@senars/util';
import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { AttentionContext, AttentionModel } from '../types.js';

export class SimpleAttention implements AttentionModel {
  readonly metadata = { name: 'simple', description: 'Fixed boost on prime, exponential decay' };

  constructor(private readonly boost = 0.3) {}

  prime(_concept: Concept, _ctx: AttentionContext): number {
    return this.boost;
  }

  decay(concept: Concept, _cycles: number, baseDecayRate: number): number {
    return forget(concept.priority, baseDecayRate);
  }

  tick(_memory: MemoryView, _cycleCount: number): void {}
}
