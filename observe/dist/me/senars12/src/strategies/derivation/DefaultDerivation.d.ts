import type { RuleEngine } from '../../rules/types';
import type { Task } from '../../types';
import type { DerivationContext, DerivationStrategy } from '../types';
import { Strategy } from '../base';
export declare class DefaultDerivation extends Strategy implements DerivationStrategy {
    constructor(name?: string, description?: string);
    derive(primary: Task, secondaries: Task[], processor: RuleEngine, ctx: DerivationContext): AsyncGenerator<Task>;
}
//# sourceMappingURL=DefaultDerivation.d.ts.map