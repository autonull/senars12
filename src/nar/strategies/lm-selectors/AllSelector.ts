import type {LMRule} from '../../lm/index.js';
import type {LMRuleSelector, LMRuleSelectionContext} from '../types.js';

export class AllSelector implements LMRuleSelector {
  readonly metadata = { name: 'all', description: 'Fire all eligible LM rules' };
  select(rules: LMRule[], _ctx: LMRuleSelectionContext): LMRule[] { return [...rules]; }
}
