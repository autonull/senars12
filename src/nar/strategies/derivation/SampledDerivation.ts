import type {Task} from '../../types/core.js';
import type {RuleProcessor} from '../../rules/processor.js';
import type {DerivationContext} from '../types.js';
import {DefaultDerivation} from './DefaultDerivation.js';

export class SampledDerivation extends DefaultDerivation {
  override readonly metadata = { name: 'sampled', description: 'Random subset of secondaries' };

  override async *derive(primary: Task, secondaries: Task[], processor: RuleProcessor, ctx: DerivationContext): AsyncGenerator<Task> {
    const maxPairs = Math.min(secondaries.length, Math.max(1, Math.ceil(secondaries.length * 0.3)));
    const shuffled = [...secondaries].sort(() => Math.random() - 0.5).slice(0, maxPairs);
    yield* super.derive(primary, shuffled, processor, ctx);
  }
}
