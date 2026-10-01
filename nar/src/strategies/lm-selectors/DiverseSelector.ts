import { selectTopN } from '@senars/util';
import type { ModelRule } from '../../rules/types.js';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types.js';

export class DiverseSelector implements ModelRuleSelector {
  readonly metadata = { name: 'diverse', description: 'One per category, then round-robin' };

  select(rules: ModelRule[], ctx: ModelRuleSelectionContext): ModelRule[] {
    const byCat = new Map<string, ModelRule[]>();
    for (const r of rules) {
      const cat = r.category ?? 'general';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(r);
    }
    const perCat = Math.max(1, Math.floor(ctx.maxRules / byCat.size));
    return selectTopN(
      [...byCat.values()].flatMap((cat) => selectTopN(cat, perCat, (rule) => rule.priority)),
      ctx.maxRules,
      (rule) => rule.priority
    );
  }
}
