import type { Concept } from '../../memory/concept';
import type { AttentionContext } from '../types';
import { SimpleAttention } from './SimpleAttention';
export declare class SpreadingActivation extends SimpleAttention {
    constructor(boost?: number);
    /**
     * Spreading reads the link **port**, not a private graph on `Concept`.
     *
     * It used to walk `concept.forEachLink`, which `mergeWith` was the only writer
     * of — so on an ordinary store the walk found nothing and this model was a
     * `SimpleAttention` with a longer name. `LinkManager` is where links actually
     * live and `ctx.memory.links()` is how a consumer reads them, so the boost now
     * reaches the neighbours a term genuinely has (TODO29.a §5.4, finding 6).
     */
    prime(concept: Concept, ctx: AttentionContext): number;
}
//# sourceMappingURL=SpreadingActivation.d.ts.map