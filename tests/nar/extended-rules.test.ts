import { describe, expect, it } from 'vitest';
import { BUILTIN_DECLARATIONS, RULE_BODIES } from '../../nar/src/rules';

describe('Extended NAL Rules — declared, not registered', () => {
  it('should declare all extended rules with resolvable truth functions', () => {
    const extendedRuleIds = [
      'nal.structuralInheritance',
      'nal.structuralReduction',
      'nal.intersectionComposition',
      'nal.unionComposition',
      'nal.difference',
      'nal.implicationDeduction',
      'nal.equivalence',
      'nal.variableIntroduction',
      'nal.decomposition',
      'nal.variableDependency',
      'nal.sameness',
      'nal.revisionWeak',
      'nal.extended.exemplification',
    ];

    const declared = new Map(BUILTIN_DECLARATIONS.map((rule) => [rule.ruleId, rule]));
    for (const ruleId of extendedRuleIds) {
      const rule = declared.get(ruleId);
      expect(rule, ruleId).toBeDefined();
      expect(RULE_BODIES[rule!.body], `${ruleId} body ${rule!.body}`).toBeTypeOf('function');
    }
  });

  it('should declare all NAL rules with a resolvable body', () => {
    const nal = BUILTIN_DECLARATIONS.filter((rule) => rule.ruleId.startsWith('nal.'));
    const resolvable = nal.filter((rule) => RULE_BODIES[rule.body]);

    expect(nal.length).toBeGreaterThan(0);
    // A rule whose body resolves to nothing is a rule that derives nothing.
    expect(nal.filter((rule) => !RULE_BODIES[rule.body]).map((rule) => rule.ruleId)).toEqual([]);
    expect(resolvable).toHaveLength(nal.length);
  });
});