import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { AttentionContext, AttentionModel } from '../types';
import { ConfigurableStrategy } from '../base';
export declare class SimpleAttention extends ConfigurableStrategy<{
    boost: number;
}> implements AttentionModel {
    constructor(boost?: number, name?: string, description?: string);
    prime(_concept: Concept, _ctx: AttentionContext): number;
    decay(concept: Concept, _cycles: number, baseDecayRate: number): number;
    tick(_memory: MemoryView, _cycleCount: number): void;
}
//# sourceMappingURL=SimpleAttention.d.ts.map