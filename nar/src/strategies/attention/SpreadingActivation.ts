import type {Concept} from '../../memory';
import type {AttentionContext} from '../types.js';
import {SimpleAttention} from './SimpleAttention.js';

export class SpreadingActivation extends SimpleAttention {
    override readonly metadata = {
        name: 'spreading',
        description: 'Prime propagates through term links',
    };

    override prime(concept: Concept, ctx: AttentionContext): number {
        const boost = super.prime(concept, ctx);
        const links = concept.getLinks();
        for (const link of links) {
            const target = ctx.memory.getConcept(link.concept.term);
            if (target && target !== concept) {
                target.priority = Math.min(1, target.priority + boost * (link.strength ?? 0.3));
            }
        }
        return boost;
    }
}
