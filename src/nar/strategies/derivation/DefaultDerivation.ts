import type {Task} from '../../types';
import {createBudget} from '../../types';
import type {RuleInput, RuleProcessor, RuleResult} from '../../rules';
import type {DerivationContext, DerivationStrategy} from '../types.js';

export const toTask = (r: RuleResult): Task => ({
    term: r.term,
    type: 'belief',
    truth: r.truth,
    budget: createBudget(r.priority),
    stamp: r.stamp,
    occurrenceTime: Date.now() as any,
    derived: true
});

export class DefaultDerivation implements DerivationStrategy {
    readonly metadata = {name: 'default', description: 'Iterate all secondaries, fire sync+LM per pair'};

    async* derive(primary: Task, secondaries: Task[], processor: RuleProcessor, ctx: DerivationContext): AsyncGenerator<Task> {
        if (secondaries.length > 0) {
            for (const secondary of secondaries) {
                if (ctx.signal?.aborted) return;
                const p1: RuleInput = {term: primary.term, truth: primary.truth, stamp: primary.stamp};
                const p2: RuleInput = {term: secondary.term, truth: secondary.truth, stamp: secondary.stamp};

                for (const result of processor.processSync(p1, p2)) yield toTask(result);
                for await (const result of processor.processLMRules(p1, p2, {signal: ctx.signal})) yield toTask(result);
            }
        } else if (ctx.singlePremiseEnabled) {
            const p1: RuleInput = {term: primary.term, truth: primary.truth, stamp: primary.stamp};
            for await (const result of processor.processLMRules(p1, undefined, {
                signal: ctx.signal,
                singlePremise: true
            })) yield toTask(result);
        }
    }
}
