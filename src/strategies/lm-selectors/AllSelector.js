import { Strategy } from '../base';
export class AllSelector extends Strategy {
    constructor() {
        super('all', 'Fire all eligible LM rules');
    }
    select(rules, _ctx) {
        return rules;
    }
}
