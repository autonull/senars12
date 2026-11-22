import { selectTopN } from '@senars/util/collections';
import type { ModelRule } from '../../rules/types';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types';

export class PrioritySelector implements ModelRuleSelector {
  readonly metadata = { name: 'priority', description: 'Top-N by rule priority' };

  select(rules: ModelRule[], ctx: ModelRuleSelectionContext): ModelRule[] {
    return selectTopN(rules, ctx.maxRules, (rule) => rule.priority);
  }
}
