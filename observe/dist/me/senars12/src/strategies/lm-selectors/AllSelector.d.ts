import type { ModelRule } from '../../rules/types';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types';
import { Strategy } from '../base';
export declare class AllSelector extends Strategy implements ModelRuleSelector {
    constructor();
    select(rules: ModelRule[], _ctx: ModelRuleSelectionContext): ModelRule[];
}
//# sourceMappingURL=AllSelector.d.ts.map