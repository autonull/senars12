import type { ModelRule } from '../../rules/types';
import type { ModelRuleSelectionContext, ModelRuleSelector } from '../types';

export class RotationSelector implements ModelRuleSelector {
  readonly metadata = { name: 'rotation', description: 'Round-robin across cycles' };

  constructor(private readonly offset = 0) {}

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
