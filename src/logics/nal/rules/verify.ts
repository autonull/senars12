import type { RuleId } from '../../../kernel/step';
import { RULE_TABLE, NAL_RULES } from './table';

/** Verify rule table completeness. */
export function verifyRuleTable(): { complete: boolean; missing: RuleId[]; duplicates: RuleId[] } {
  const expectedIds: RuleId[] = [
    'deduction', 'induction', 'abduction', 'revision',
    'comparison', 'analogy', 'resemblance',
    'negation', 'conversion_inheritance', 'conversion_similarity',
    'structural_deduction',
    'prediction', 'postdiction',
    'higher_order_deduction',
    'variable_introduction',
    'introspection',
  ];

  const missing = expectedIds.filter(id => !RULE_TABLE.has(id));
  const seen = new Set<RuleId>();
  const duplicates: RuleId[] = [];
  for (const rule of NAL_RULES) {
    if (seen.has(rule.id)) duplicates.push(rule.id);
    seen.add(rule.id);
  }

  return { complete: missing.length === 0 && duplicates.length === 0, missing, duplicates };
}