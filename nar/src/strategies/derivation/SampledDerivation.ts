import { ambientRng, shareOf, shuffleInPlace } from '@senars/util';
import type { RuleEngine } from '../../rules/types.js';
import type { Task } from '../../types';
import type { RandomSource } from '../../types/primitives.js';
import type { DerivationContext } from '../types.js';
import { DefaultDerivation } from './DefaultDerivation.js';

export class SampledDerivation extends DefaultDerivation {
  override readonly metadata = { name: 'sampled', description: 'Random subset of secondaries' };

  constructor(
    private readonly rng: RandomSource = ambientRng,
    /** Fraction of secondaries to draw; the rest is the budget the slot gives back. */
    private readonly fraction = 0.3
  ) {
    super();
  }

  override async *derive(
    primary: Task,
    secondaries: Task[],
    processor: RuleEngine,
    ctx: DerivationContext
  ): AsyncGenerator<Task> {
    const pool = shuffleInPlace([...secondaries], this.rng);
    yield* super.derive(primary, shareOf(pool, this.fraction, 1), processor, ctx);
  }
}
