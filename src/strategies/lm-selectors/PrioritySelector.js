import { selectTopN } from '@senars/util/collections';
import { Strategy } from '../base';
export class PrioritySelector extends Strategy {
    constructor() {
        super('priority', 'Top-N by rule priority');
    }
    select(rules, ctx) {
        return selectTopN(rules, ctx.maxRules, (rule) => rule.priority);
    }
}
