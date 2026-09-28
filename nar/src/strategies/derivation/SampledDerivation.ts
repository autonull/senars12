import type { RuleEngine } from '../../rules/types.js';
import type { RandomSource } from '../../types/primitives.js';
import type { Task } from '../../types';
import type { DerivationContext } from '../types.js';
import { DefaultDerivation } from './DefaultDerivation.js';
import { shuffleInPlace } from '../../utils/random.js';

export class SampledDerivation extends DefaultDerivation {
  override readonly metadata = { name: 'sampled', description: 'Random subset of secondaries' };

  constructor(private readonly rng: RandomSource = Math.random) {
    super();
  }

  override async *derive(
    primary: Task,
    secondaries: Task[],
    processor: RuleEngine,
    ctx: DerivationContext
  ): AsyncGenerator<Task> {
    const maxPairs = Math.min(secondaries.length, Math.max(1, Math.ceil(secondaries.length * 0.3)));
    const pool = shuffleInPlace([...secondaries], this.rng);
    yield* super.derive(primary, pool.slice(0, maxPairs), processor, ctx);
  }
}
