import { describe, expect, it } from 'vitest';
import { BUILTIN_DECLARATIONS, DISABLED_RULES, NAL_EXTENDED_RULES, RULE_BODIES } from '../../nar/src/rules';

const bodyOfDisabled = (ruleId: string): string | undefined =>
  NAL_EXTENDED_RULES.find((rule) => rule.id === ruleId)?.body;

describe('Extended NAL Rules — declared, not registered', () => {
  it('should declare all extended rules with resolvable truth functions', () => {
    // Every rule body still resolves — including for rules that are declared but
    // not shipped, because a disabled rule with a broken body is a trap for
    // whoever re-enables it. Shipping is asserted separately.
    const ruleIds = [
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
    for (const ruleId of ruleIds) {
      const body = declared.get(ruleId)?.body ?? bodyOfDisabled(ruleId);
      if (!body) throw new Error(`${ruleId} declares no body`);
      expect(RULE_BODIES[body], `${ruleId} body ${body}`).toBeTypeOf('function');
    }

    // Every rule that is off says why, in data, so the reason cannot rot into a
    // comment nobody reads.
    for (const ruleId of Object.keys(DISABLED_RULES)) {
      expect(DISABLED_RULES[ruleId]?.trim().length, `${ruleId} reason`).toBeGreaterThan(10);
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