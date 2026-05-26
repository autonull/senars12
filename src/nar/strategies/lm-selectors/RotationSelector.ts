import type {LMRule} from '../../lm/index.js';
import type {LMRuleSelector, LMRuleSelectionContext} from '../types.js';

export class RotationSelector implements LMRuleSelector {
  readonly metadata = { name: 'rotation', description: 'Round-robin across cycles' };
  select(rules: LMRule[], ctx: LMRuleSelectionContext): LMRule[] {
    const start = ctx.rotationIndex ?? 0;
    const result: LMRule[] = [];
    for (let i = 0; i < ctx.maxRules && result.length < rules.length; i++) {
      const rule = rules[(start + i) % rules.length];
      if (rule) result.push(rule);
    }
    return result;
  }
}
