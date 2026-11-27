import type { ModelRule } from '../../rules/types';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types';
import { Strategy } from '../base';
export declare class DiverseSelector extends Strategy implements ModelRuleSelector {
    constructor();
    select(rules: ModelRule[], ctx: ModelRuleSelectionContext): ModelRule[];
}
//# sourceMappingURL=DiverseSelector.d.ts.map