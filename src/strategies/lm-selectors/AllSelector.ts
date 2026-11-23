import type { ModelRule } from '../../rules/types';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types';
import { Strategy } from '../base';

export class AllSelector extends Strategy implements ModelRuleSelector {
  constructor() {
    super('all', 'Fire all eligible LM rules');
  }

  select(rules: ModelRule[], _ctx: ModelRuleSelectionContext): ModelRule[] {
    return rules;
  }
}