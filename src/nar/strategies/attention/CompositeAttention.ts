import type {Concept, Memory} from '../../memory';
import type {AttentionContext, AttentionModel} from '../types.js';

export class CompositeAttention implements AttentionModel {
    readonly metadata = {name: 'composite', description: 'Weighted combination of attention models'};

    constructor(
        private readonly models: Array<{ model: AttentionModel; weight: number }>
    ) {
    }

    prime(concept: Concept, ctx: AttentionContext): number {
        return this.models.reduce((sum, m) => sum + m.model.prime(concept, ctx) * m.weight, 0);
    }

    decay(concept: Concept, cycles: number, rate: number): number {
        return this.models.reduce((sum, m) => sum + m.model.decay(concept, cycles, rate) * m.weight, 0);
    }

    tick(memory: Memory, cycleCount: number): void {
        for (const m of this.models) m.model.tick(memory, cycleCount);
    }
}
