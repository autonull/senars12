import type { ModelRule } from '../../rules/types';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types';
import { ConfigurableStrategy } from '../base';
interface CompositeLMRuleSelectorConfig {
    selectors: ModelRuleSelector[];
}
/**
 * Union of several LM-rule selectors: every selector proposes, the union is
 * deduped by rule id and capped at the caller's `maxRules`. The complement of
 * (TODO27 §2.5) a selector set is a union, not a lottery.
 */
export declare class CompositeLMRuleSelector extends ConfigurableStrategy<CompositeLMRuleSelectorConfig> implements ModelRuleSelector {
    constructor(selectors: ModelRuleSelector[]);
    select(rules: ModelRule[], ctx: ModelRuleSelectionContext): ModelRule[];
}
export {};
//# sourceMappingURL=CompositeLMRuleSelector.d.ts.map