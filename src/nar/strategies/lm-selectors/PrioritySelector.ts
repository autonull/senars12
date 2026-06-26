import type {LMRule} from '../../lm';
import type {LMRuleSelectionContext, LMRuleSelector} from '../types.js';

export class PrioritySelector implements LMRuleSelector {
    readonly metadata = {name: 'priority', description: 'Top-N by rule priority'};

    select(rules: LMRule[], ctx: LMRuleSelectionContext): LMRule[] {
        return [...rules].sort((a, b) => b.priority - a.priority).slice(0, ctx.maxRules);
    }
}
