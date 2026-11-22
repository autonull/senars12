import type { ModelRule } from '../../rules/types';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types';

export class AllSelector implements ModelRuleSelector {
  readonly metadata = { name: 'all', description: 'Fire all eligible LM rules' };

  select(rules: ModelRule[], _ctx: ModelRuleSelectionContext): ModelRule[] {
    return rules;
  }
}
