import type {Task} from '../../types';
import type {RuleProcessor} from '../../rules';
import type {DerivationContext} from '../types.js';
import {DefaultDerivation} from './DefaultDerivation.js';
import {wordOverlap} from '../../utils';

const SPLIT_PATTERN = /[\s_()<>]+/;

export class FocusedDerivation extends DefaultDerivation {
    override readonly metadata = {name: 'focused', description: 'Prioritize high-relevance secondaries'};

    override async* derive(primary: Task, secondaries: Task[], processor: RuleProcessor, ctx: DerivationContext): AsyncGenerator<Task> {
        const sorted = [...secondaries].sort((a, b) => {
            const scoreA = a.budget.priority + this.sharedAtomScore(primary, a);
            const scoreB = b.budget.priority + this.sharedAtomScore(primary, b);
            return scoreB - scoreA;
        });
        yield* super.derive(primary, sorted, processor, ctx);
    }

    private sharedAtomScore(a: Task, b: Task): number {
        const aStr = a.term.toString();
        const bStr = b.term.toString();
        return wordOverlap(aStr, bStr, SPLIT_PATTERN);
    }
}