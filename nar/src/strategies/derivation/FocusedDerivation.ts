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
    // trees. Decorate-sort-undecorate keeps the order — same scores, stable sort.
    const scored = secondaries.map((task) => ({
      task,
      score: task.budget.priority + this.sharedAtomScore(primary, task),
    }));
    scored.sort((a, b) => b.score - a.score);
    yield* super.derive(
      primary,
      scored.map(({ task }) => task),
      processor,
      ctx
    );
  }

  private sharedAtomScore(a: Task, b: Task): number {
    return sharesSymbol(a.term, b.term) ? 1 : 0;
  }
}
