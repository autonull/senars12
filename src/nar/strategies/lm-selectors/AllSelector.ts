import type {LMRule} from '../../lm';
import type {LMRuleSelectionContext, LMRuleSelector} from '../types.js';

export class AllSelector implements LMRuleSelector {
    readonly metadata = {name: 'all', description: 'Fire all eligible LM rules'};

    select(rules: LMRule[], _ctx: LMRuleSelectionContext): LMRule[] {
        return [...rules];
    }
}
