import { groupBy, perPart, selectTopN } from '@senars/util/collections';
import { Strategy } from '../base';
export class DiverseSelector extends Strategy {
    constructor() {
        super('diverse', 'One per category, then round-robin');
    }
    select(rules, ctx) {
        const byCat = groupBy(rules, (r) => r.category ?? 'general');
        const perCat = perPart(ctx.maxRules, byCat.size);
        return selectTopN([...byCat.values()].flatMap((cat) => selectTopN(cat, perCat, (rule) => rule.priority)), ctx.maxRules, (rule) => rule.priority);
    }
}
