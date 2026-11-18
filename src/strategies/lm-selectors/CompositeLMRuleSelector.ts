import { groupBy, mapToRecord, selectTopN } from '@senars/util';

import type { ModelRule } from '../../rules/types.js';
import { termKey } from '../../terms';
import type { ComponentMetadata, ModelRuleSelectionContext, ModelRuleSelector } from '../types.js';

/**
 * Union of several LM-rule selectors: every selector proposes, the union is
 * deduped by rule id and capped at the caller's `maxRules`. The complement of
 * (TODO27 §2.5) a selector set is a union, not a lottery.
 */
export class CompositeLMRuleSelector implements ModelRuleSelector {
  readonly metadata: ComponentMetadata = {
    name: 'composite',
    description: 'Union of several LM-rule selectors',
  };

  constructor(private readonly selectors: ModelRuleSelector[]) {}

  select(rules: ModelRule[], ctx: ModelRuleSelectionContext): ModelRule[] {
    const proposed = this.selectors.flatMap((selector) => selector.select(rules, ctx));
    const union = mapToRecord(
      groupBy(proposed, (rule) => rule.id),
      (sameRule) => sameRule[0]!
    );
    return selectTopN(Object.values(union), ctx.maxRules, (rule) => rule.priority);
  }
}
