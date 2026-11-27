import type { ModelRule } from '../../rules/types';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types';
import { ConfigurableStrategy } from '../base';
interface RotationSelectorConfig {
    offset: number;
}
export declare class RotationSelector extends ConfigurableStrategy<RotationSelectorConfig> implements ModelRuleSelector {
    constructor(offset?: number);
    get offset(): number;
    select(rules: ModelRule[], ctx: ModelRuleSelectionContext): ModelRule[];
}
export {};
//# sourceMappingURL=RotationSelector.d.ts.map