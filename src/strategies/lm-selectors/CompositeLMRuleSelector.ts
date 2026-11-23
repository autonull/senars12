import type { ModelRule } from '../../rules/types';
import type { ComponentMetadata, ModelRuleSelectionContext, ModelRuleSelector } from '../types';
import { createCappedUnionComposite, type Composable } from '../composite';
import { ConfigurableStrategy } from '../base';

interface CompositeLMRuleSelectorConfig {
  selectors: ModelRuleSelector[];
}

/**
 * Union of several LM-rule selectors: every selector proposes, the union is
 * deduped by rule id and capped at the caller's `maxRules`. The complement of
 * (TODO27 §2.5) a selector set is a union, not a lottery.
 */
export class CompositeLMRuleSelector extends ConfigurableStrategy<CompositeLMRuleSelectorConfig>
  implements ModelRuleSelector {
  constructor(selectors: ModelRuleSelector[]) {
    super('composite', 'Union of several LM-rule selectors', { selectors });
  }

  select(rules: ModelRule[], ctx: ModelRuleSelectionContext): ModelRule[] {
    const composables: Composable<[ModelRule[], ModelRuleSelectionContext], ModelRule[]>[] =
      this.config.selectors.map((selector) => ({
        metadata: { name: selector.metadata.name, description: selector.metadata.description },
        execute([rs, context]) {
          return selector.select(rs, context);
        },
      }));

    const composite = createCappedUnionComposite(
      composables,
      (r) => r.id, // dedupe by rule id
      (r) => r.priority,
      ctx.maxRules,
      { name: 'composite', description: 'Capped union of LM-rule selectors' }
    );

    return composite.execute([rules, ctx]);
  }
}