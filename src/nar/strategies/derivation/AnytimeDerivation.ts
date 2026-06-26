import type {Task} from '../../types/core.js';
import type {RuleProcessor} from '../../rules/processor.js';
import type {DerivationContext} from '../types.js';
import {DefaultDerivation} from './DefaultDerivation.js';

export class AnytimeDerivation extends DefaultDerivation {
    override readonly metadata = {
        name: 'anytime',
        description: 'Yield as results become available, stop early if signal aborted'
    };

    override async* derive(primary: Task, secondaries: Task[], processor: RuleProcessor, ctx: DerivationContext): AsyncGenerator<Task> {
        if (ctx.signal?.aborted) return;
        yield* super.derive(primary, secondaries, processor, ctx);
    }
}
