import type { RuleEngine } from '../../rules/types.js';
import type { Task } from '../../types';
import type { DerivationContext } from '../types.js';
import { DefaultDerivation } from './DefaultDerivation.js';

export class AnytimeDerivation extends DefaultDerivation {
  override readonly metadata = {
    name: 'anytime',
    description: 'Yield as results become available, stop early if signal aborted',
  };

  override async *derive(
    primary: Task,
    secondaries: Task[],
    processor: RuleEngine,
    ctx: DerivationContext
  ): AsyncGenerator<Task> {
    if (ctx.signal?.aborted) return;
    yield* super.derive(primary, secondaries, processor, ctx);
  }
}
