import type { RuleId, RuleCategory } from '../../../kernel/step';
import type { NALRule } from './types';
import { CORE_RULES } from './core-rules';
import { COMPARISON_RULES } from './comparison-rules';
import { STRUCTURAL_RULES } from './structural-rules';
import { NAL_TEMPORAL_RULES } from './temporal-rules';
import { HIGHER_ORDER_RULES } from './higher-order-rules';
import { VARIABLE_RULES } from './variable-rules';
import { META_RULES } from './meta-rules';

/** All NAL rules combined. */
export const NAL_RULES: NALRule[] = [
  ...CORE_RULES,
  ...COMPARISON_RULES,
  ...STRUCTURAL_RULES,
  ...NAL_TEMPORAL_RULES,
  ...HIGHER_ORDER_RULES,
  ...VARIABLE_RULES,
  ...META_RULES,
];

/** Rule table: maps rule IDs to rule definitions. */
export const RULE_TABLE = new Map<RuleId, NALRule>();
for (const rule of NAL_RULES) {
  RULE_TABLE.set(rule.id, rule);
}

/** Get rule by ID. */
export function getRule(id: RuleId): NALRule | undefined {
  return RULE_TABLE.get(id);
}

/** Get rules by category. */
export function getRulesByCategory(category: RuleCategory): NALRule[] {
  return NAL_RULES.filter(r => r.category === category);
}

/** Get all rule IDs. */
export function getAllRuleIds(): RuleId[] {
  return NAL_RULES.map(r => r.id);
}

/** Check if a rule is built-in (always present). */
export function isBuiltinRule(id: RuleId): boolean {
  const rule = RULE_TABLE.get(id);
  // All current rules are built-in
  return rule !== undefined;
}