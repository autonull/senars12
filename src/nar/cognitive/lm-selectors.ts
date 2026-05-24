import type {LMRule} from '../lm';
import type {LMRuleSelector, LMRuleSelectionContext} from './types';

export class AllSelector implements LMRuleSelector {
  readonly metadata = { name: 'all', description: 'Fire all eligible LM rules' };
  select(rules: LMRule[], _ctx: LMRuleSelectionContext): LMRule[] { return [...rules]; }
}

export class PrioritySelector implements LMRuleSelector {
  readonly metadata = { name: 'priority', description: 'Top-N by rule priority' };
  select(rules: LMRule[], ctx: LMRuleSelectionContext): LMRule[] {
    return [...rules].sort((a, b) => b.priority - a.priority).slice(0, ctx.maxRules);
  }
}

export class RotationSelector implements LMRuleSelector {
  readonly metadata = { name: 'rotation', description: 'Round-robin across cycles' };
  select(rules: LMRule[], ctx: LMRuleSelectionContext): LMRule[] {
    const start = ctx.rotationIndex ?? 0;
    const result: LMRule[] = [];
    for (let i = 0; i < ctx.maxRules && result.length < rules.length; i++) {
      const rule = rules[(start + i) % rules.length];
      if (rule) result.push(rule);
    }
    return result;
  }
}

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
      .flatMap(cat => cat.sort((a, b) => b.priority - a.priority).slice(0, perCat))
      .slice(0, ctx.maxRules);
  }
}
