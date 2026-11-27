import { ambientRng, shuffleInPlace } from '@senars/util/random';
import { shareOf } from '@senars/util/collections';
import { DefaultDerivation } from './DefaultDerivation';
export class SampledDerivation extends DefaultDerivation {
    rng;
    fraction;
    metadata = { name: 'sampled', description: 'Random subset of secondaries' };
    constructor(rng = ambientRng, 
    /** Fraction of secondaries to draw; the rest is the budget the slot gives back. */
    fraction = 0.3) {
        super();
        this.rng = rng;
        this.fraction = fraction;
    }
    async *derive(primary, secondaries, processor, ctx) {
        const pool = shuffleInPlace([...secondaries], this.rng);
        yield* super.derive(primary, shareOf(pool, this.fraction, 1), processor, ctx);
    }
}
