import type {Task} from '../../types/core.js';
import {createBudget} from '../../types/core.js';
import type {RuleProcessor, RuleResult, RuleInput} from '../../rules/processor.js';
import type {DerivationStrategy, DerivationContext} from '../types.js';

export const toTask = (r: RuleResult): Task => ({
  term: r.term, type: 'belief', truth: r.truth, budget: createBudget(r.priority), stamp: r.stamp, occurrenceTime: Date.now(), derived: true
});

export class DefaultDerivation implements DerivationStrategy {
  readonly metadata = { name: 'default', description: 'Iterate all secondaries, fire sync+LM per pair' };

  async *derive(primary: Task, secondaries: Task[], processor: RuleProcessor, ctx: DerivationContext): AsyncGenerator<Task> {
    if (secondaries.length > 0) {
      for (const secondary of secondaries) {
        if (ctx.signal?.aborted) return;
        const p1: RuleInput = { term: primary.term, truth: primary.truth, stamp: primary.stamp };
        const p2: RuleInput = { term: secondary.term, truth: secondary.truth, stamp: secondary.stamp };

        for (const result of processor.processSync(p1, p2)) yield toTask(result);
        for await (const result of processor.processLMRulesExternal(p1, p2, ctx.signal)) yield toTask(result);
      }
    } else if (ctx.singlePremiseEnabled) {
      const p1: RuleInput = { term: primary.term, truth: primary.truth, stamp: primary.stamp };
      for await (const result of processor.processLMRulesSingle(p1, ctx.signal)) yield toTask(result);
    }
  }
}
