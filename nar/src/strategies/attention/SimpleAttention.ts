import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { AttentionContext, AttentionModel } from '../types.js';

export class SimpleAttention implements AttentionModel {
  readonly metadata = { name: 'simple', description: 'Fixed boost on prime, exponential decay' };

  prime(_concept: Concept, _ctx: AttentionContext): number {
    return 0.3;
  }

  decay(concept: Concept, _cycles: number, baseDecayRate: number): number {
    return concept.priority * baseDecayRate;
  }

  tick(_memory: MemoryView, _cycleCount: number): void {}
}
