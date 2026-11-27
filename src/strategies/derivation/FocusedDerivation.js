import { rankBy } from '@senars/util/collections';
import { sharesSymbol } from '../../terms';
import { DefaultDerivation } from './DefaultDerivation';
export class FocusedDerivation extends DefaultDerivation {
    constructor() {
        super('focused', 'Prioritize high-relevance secondaries');
    }
    async *derive(primary, secondaries, processor, ctx) {
        // Scored once each, not once per comparison: `sharesSymbol` walks both term
        // trees. rankBy is stable, so equal scores keep the order they arrived in.
        const ranked = rankBy(secondaries, (task) => task.budget.priority + this.sharedAtomScore(primary, task));
        yield* super.derive(primary, ranked, processor, ctx);
    }
    sharedAtomScore(a, b) {
        return sharesSymbol(a.term, b.term) ? 1 : 0;
    }
}
