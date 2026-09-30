import type { LMRule } from '../../lm';
import { selectTopN } from '@senars/util';
import type { LMRuleSelectionContext, LMRuleSelector } from '../types.js';

export class PrioritySelector implements LMRuleSelector {
  readonly metadata = { name: 'priority', description: 'Top-N by rule priority' };

  select(rules: LMRule[], ctx: LMRuleSelectionContext): LMRule[] {
    return selectTopN(rules, ctx.maxRules, (rule) => rule.priority);
  }
}
