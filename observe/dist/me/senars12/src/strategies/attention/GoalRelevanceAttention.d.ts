import type { Concept } from '../../memory/concept';
import type { AttentionContext } from '../types';
import { SimpleAttention } from './SimpleAttention';
export declare class GoalRelevanceAttention extends SimpleAttention {
    constructor(boost?: number);
    prime(concept: Concept, ctx: AttentionContext): number;
    private goalOverlap;
}
//# sourceMappingURL=GoalRelevanceAttention.d.ts.map