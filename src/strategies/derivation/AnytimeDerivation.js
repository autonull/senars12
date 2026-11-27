import { DefaultDerivation } from './DefaultDerivation';
export class AnytimeDerivation extends DefaultDerivation {
    metadata = {
        name: 'anytime',
        description: 'Yield as results become available, stop early if signal aborted',
    };
    async *derive(primary, secondaries, processor, ctx) {
        if (ctx.signal?.aborted)
            return;
        yield* super.derive(primary, secondaries, processor, ctx);
    }
}
