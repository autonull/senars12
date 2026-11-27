import type { RuleEngine } from '../../rules/types';
import type { Task } from '../../types';
import type { DerivationContext } from '../types';
import { DefaultDerivation } from './DefaultDerivation';
export declare class AnytimeDerivation extends DefaultDerivation {
    readonly metadata: {
        name: string;
        description: string;
    };
    derive(primary: Task, secondaries: Task[], processor: RuleEngine, ctx: DerivationContext): AsyncGenerator<Task>;
}
//# sourceMappingURL=AnytimeDerivation.d.ts.map