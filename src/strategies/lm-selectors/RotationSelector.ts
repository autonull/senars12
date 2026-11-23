import type { ModelRule } from '../../rules/types';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types';
import { ConfigurableStrategy } from '../base';

interface RotationSelectorConfig {
  offset: number;
}

export class RotationSelector extends ConfigurableStrategy<RotationSelectorConfig>
  implements ModelRuleSelector {
  constructor(offset = 0) {
    super('rotation', 'Round-robin across cycles', { offset });
  }

  get offset(): number {
    return this.config.offset;
  }

  select(rules: ModelRule[], ctx: ModelRuleSelectionContext): ModelRule[] {
    const start = (ctx.rotationIndex ?? 0) + this.offset;
    const result: ModelRule[] = [];
    for (let i = 0; i < ctx.maxRules && result.length < rules.length; i++) {
      const rule = rules[(start + i) % rules.length];
      if (rule) result.push(rule);
    }
    return result;
  }
}