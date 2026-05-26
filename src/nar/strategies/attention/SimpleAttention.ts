import type {Concept, Memory} from '../../memory/index.js';
import type {AttentionModel, AttentionContext} from '../types.js';

export class SimpleAttention implements AttentionModel {
  readonly metadata = { name: 'simple', description: 'Fixed boost on prime, exponential decay' };

  prime(_concept: Concept, _ctx: AttentionContext): number {
    return 0.3;
  }

  decay(concept: Concept, _cycles: number, baseDecayRate: number): number {
    return concept.priority * baseDecayRate;
  }

  tick(_memory: Memory, _cycleCount: number): void {}
}
