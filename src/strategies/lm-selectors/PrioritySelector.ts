import { selectTopN } from '@senars/util';
import type { ModelRule } from '../../rules/types.js';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types.js';

export class PrioritySelector implements ModelRuleSelector {
  readonly metadata = { name: 'priority', description: 'Top-N by rule priority' };

  select(rules: ModelRule[], ctx: ModelRuleSelectionContext): ModelRule[] {
    return selectTopN(rules, ctx.maxRules, (rule) => rule.priority);
  }
}
