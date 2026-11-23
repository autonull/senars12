import { selectTopN } from '@senars/util/collections';
import type { ModelRule } from '../../rules/types';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types';
import { Strategy } from '../base';

export class PrioritySelector extends Strategy implements ModelRuleSelector {
  constructor() {
    super('priority', 'Top-N by rule priority');
  }

  select(rules: ModelRule[], ctx: ModelRuleSelectionContext): ModelRule[] {
    return selectTopN(rules, ctx.maxRules, (rule) => rule.priority);
  }
}