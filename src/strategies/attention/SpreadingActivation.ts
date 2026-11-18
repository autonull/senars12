import type { Concept } from '../../memory/concept.js';
import type { AttentionContext } from '../types.js';
import { SimpleAttention } from './SimpleAttention.js';

export class SpreadingActivation extends SimpleAttention {
  override readonly metadata = {
    name: 'spreading',
    description: 'Prime propagates through term links',
  };

  /**
   * Spreading reads the link **port**, not a private graph on `Concept`.
   *
   * It used to walk `concept.forEachLink`, which `mergeWith` was the only writer
   * of — so on an ordinary store the walk found nothing and this model was a
   * `SimpleAttention` with a longer name. `LinkManager` is where links actually
   * live and `ctx.memory.links()` is how a consumer reads them, so the boost now
   * reaches the neighbours a term genuinely has (TODO29.a §5.4, finding 6).
   */
  override prime(concept: Concept, ctx: AttentionContext): number {
    const boost = super.prime(concept, ctx);
    const links = ctx.memory.links().getLinks(concept.term);
    for (const { targetTerm, priority } of links) {
      const target = ctx.memory.getConcept(targetTerm);
      if (!target || target === concept) continue;
      target.writeAttention({ reason: 'related', amount: boost * priority });
    }
    return boost;
  }
}
