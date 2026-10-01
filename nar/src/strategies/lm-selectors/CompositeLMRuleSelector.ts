import { selectTopN } from '@senars/util';

import type { ModelRule } from '../../rules/types.js';
import { termKey } from '../../terms';
import type { ComponentMetadata, ModelRuleSelectionContext, ModelRuleSelector } from '../types.js';

/**
 * Union of several LM-rule selectors: every selector proposes, the union is
 * deduped by rule id and capped at the caller's `maxRules`. The complement of
 * (TODO27 §2.5) a selector set is a union, not a lottery.
 */
export class CompositeLMRuleSelector implements ModelRuleSelector {
  readonly metadata: ComponentMetadata = {
    name: 'composite',
    description: 'Union of several LM-rule selectors',
  };

  constructor(private readonly selectors: ModelRuleSelector[]) {}

  select(rules: ModelRule[], ctx: ModelRuleSelectionContext): ModelRule[] {
    const union = new Map<string, ModelRule>();
    for (const selector of this.selectors) {
      for (const rule of selector.select(rules, ctx)) if (!union.has(rule.id)) union.set(rule.id, rule);
    }
    return selectTopN(union.values(), ctx.maxRules, (rule) => rule.priority);
  }
}
