import { createCappedUnionComposite } from '../composite';
import { ConfigurableStrategy } from '../base';
/**
 * Union of several LM-rule selectors: every selector proposes, the union is
 * deduped by rule id and capped at the caller's `maxRules`. The complement of
 * (TODO27 §2.5) a selector set is a union, not a lottery.
 */
export class CompositeLMRuleSelector extends ConfigurableStrategy {
    constructor(selectors) {
        super('composite', 'Union of several LM-rule selectors', { selectors });
    }
    select(rules, ctx) {
        const composables = this.config.selectors.map((selector) => ({
            metadata: { name: selector.metadata.name, description: selector.metadata.description },
            execute([rs, context]) {
                return selector.select(rs, context);
            },
        }));
        const composite = createCappedUnionComposite(composables, (r) => r.id, // dedupe by rule id
        (r) => r.priority, ctx.maxRules, { name: 'composite', description: 'Capped union of LM-rule selectors' });
        return composite.execute([rules, ctx]);
    }
}
