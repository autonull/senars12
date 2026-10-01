import { createDerivedTask, toRuleInput } from '../../reason/inference-utils.js';
import type { RuleEngine } from '../../rules/types.js';
import type { Task } from '../../types';
import type { DerivationContext, DerivationStrategy } from '../types.js';

export class DefaultDerivation implements DerivationStrategy {
  readonly metadata = {
    name: 'default',
    description: 'Iterate all secondaries, fire sync rules per pair, stage model-backed work',
  };

  async *derive(
    primary: Task,
    secondaries: Task[],
    processor: RuleEngine,
    ctx: DerivationContext
  ): AsyncGenerator<Task> {
    const p1 = toRuleInput(primary);

    if (secondaries.length > 0) {
      for (const secondary of secondaries) {
        if (ctx.signal?.aborted) return;
        const p2 = toRuleInput(secondary);

        for (const result of processor.processSync(p1, p2)) yield createDerivedTask(result);
        processor.stageLMRules(p1, p2);
      }
    } else if (ctx.singlePremiseEnabled) {
      processor.stageLMRules(p1);
    }
  }
}
