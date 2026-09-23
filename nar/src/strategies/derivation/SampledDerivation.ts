import type { RuleProcessor } from '../../rules';
import type { RandomSource } from '../../types/primitives.js';
import type { Task } from '../../types';
import type { DerivationContext } from '../types.js';
import { DefaultDerivation } from './DefaultDerivation.js';

export class SampledDerivation extends DefaultDerivation {
  override readonly metadata = { name: 'sampled', description: 'Random subset of secondaries' };

  constructor(private readonly rng: RandomSource = Math.random) {
    super();
  }

  override async *derive(
    primary: Task,
    secondaries: Task[],
    processor: RuleProcessor,
    ctx: DerivationContext
  ): AsyncGenerator<Task> {
    const maxPairs = Math.min(secondaries.length, Math.max(1, Math.ceil(secondaries.length * 0.3)));
    const pool = [...secondaries];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    yield* super.derive(primary, pool.slice(0, maxPairs), processor, ctx);
  }
}
