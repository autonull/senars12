import { rankBy } from '@senars/util';
import type { RuleEngine } from '../../rules/types.js';
import { sharesSymbol } from '../../terms';
import type { Task } from '../../types';
import type { DerivationContext } from '../types.js';
import { DefaultDerivation } from './DefaultDerivation.js';

export class FocusedDerivation extends DefaultDerivation {
  override readonly metadata = {
    name: 'focused',
    description: 'Prioritize high-relevance secondaries',
  };

  override async *derive(
    primary: Task,
    secondaries: Task[],
    processor: RuleEngine,
    ctx: DerivationContext
  ): AsyncGenerator<Task> {
    // Scored once each, not once per comparison: `sharesSymbol` walks both term
    // trees. rankBy is stable, so equal scores keep the order they arrived in.
    const ranked = rankBy(
      secondaries,
      (task) => task.budget.priority + this.sharedAtomScore(primary, task)
    );
    yield* super.derive(primary, ranked, processor, ctx);
  }

  private sharedAtomScore(a: Task, b: Task): number {
    return sharesSymbol(a.term, b.term) ? 1 : 0;
  }
}
