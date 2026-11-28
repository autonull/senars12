import type { RuleEngine } from '../../rules/types';
import type { Task } from '../../types';
import type { RandomSource } from '../../types/primitives';
import type { DerivationContext } from '../types';
import { DefaultDerivation } from './DefaultDerivation';
export declare class SampledDerivation extends DefaultDerivation {
    private readonly rng;
    /** Fraction of secondaries to draw; the rest is the budget the slot gives back. */
    private readonly fraction;
    readonly metadata: {
        name: string;
        description: string;
    };
    constructor(rng?: RandomSource, 
    /** Fraction of secondaries to draw; the rest is the budget the slot gives back. */
    fraction?: number);
    derive(primary: Task, secondaries: Task[], processor: RuleEngine, ctx: DerivationContext): AsyncGenerator<Task>;
}
//# sourceMappingURL=SampledDerivation.d.ts.map