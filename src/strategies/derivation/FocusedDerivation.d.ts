import type { RuleEngine } from '../../rules/types';
import type { Task } from '../../types';
import type { DerivationContext } from '../types';
import { DefaultDerivation } from './DefaultDerivation';
export declare class FocusedDerivation extends DefaultDerivation {
    constructor();
    derive(primary: Task, secondaries: Task[], processor: RuleEngine, ctx: DerivationContext): AsyncGenerator<Task>;
    private sharedAtomScore;
}
//# sourceMappingURL=FocusedDerivation.d.ts.map