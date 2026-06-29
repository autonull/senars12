import type { LMRule } from '../../lm';
import type { LMRuleSelectionContext, LMRuleSelector } from '../types.js';

export class DiverseSelector implements LMRuleSelector {
  readonly metadata = { name: 'diverse', description: 'One per category, then round-robin' };

  select(rules: LMRule[], ctx: LMRuleSelectionContext): LMRule[] {
    const byCat = new Map<string, LMRule[]>();
    for (const r of rules) {
      const cat = r.category ?? 'general';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(r);
    }
    const perCat = Math.max(1, Math.floor(ctx.maxRules / byCat.size));
    return [...byCat.values()]
      .flatMap((cat) => cat.sort((a, b) => b.priority - a.priority).slice(0, perCat))
      .slice(0, ctx.maxRules);
  }
}
