import {ReductionStage} from './ReductionStage.js';

export class RuleMatchStage extends ReductionStage {
    constructor() {
        super('rule-match');
    }

    process(atom, context) {
        if (!context.space) {
            return null;
        }
        const rules = context.space.rulesFor(atom);
        if (!rules || rules.length === 0) {
            return null;
        }
        return {matchRules: true, atom, rules};
    }
}
