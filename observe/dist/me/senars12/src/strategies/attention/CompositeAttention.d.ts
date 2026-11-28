import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { AttentionContext, AttentionModel } from '../types';
import { ConfigurableStrategy } from '../base';
export interface WeightedAttention {
    model: AttentionModel;
    weight: number;
}
export interface CompositeAttentionConfig {
    models: WeightedAttention[];
}
/**
 * A composite attention model using the generic weighted-mean composite
 * for `prime` and `decay`, and delegating `tick` to all members.
 */
export declare class CompositeAttention extends ConfigurableStrategy<CompositeAttentionConfig> implements AttentionModel {
    private readonly primeComposite;
    private readonly decayComposite;
    private readonly members;
    constructor(models: WeightedAttention[]);
    prime(concept: Concept, ctx: AttentionContext): number;
    decay(concept: Concept, cycles: number, rate: number): number;
    tick(memory: MemoryView, cycleCount: number): void;
}
//# sourceMappingURL=CompositeAttention.d.ts.map