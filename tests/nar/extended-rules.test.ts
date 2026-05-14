import {describe, expect, it} from '@jest/globals';
import {RuleRegistry} from '../../src/nar';
import '../../src/nar/rules/nal.js';
import '../../src/nar/rules/nal-extended.js';

describe('Extended NAL Rules Registration', () => {
    it('should register all extended rules with truth functions', () => {
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
            'nal.exemplification'
        ];

        extendedRuleIds.forEach(id => {
            const rule = RuleRegistry.get(id);
            expect(rule).toBeDefined();
            expect(rule?.truthFn).toBeDefined();
            expect(rule?.sync).toBe(true);
        });
    });

    it('should have all NAL rules with truth functions', () => {
        const allRules = RuleRegistry.getAll();
        const nalRules = allRules.filter(r => r.id.startsWith('nal.'));
        const rulesWithTruthFn = nalRules.filter(r => r.truthFn);

        expect(nalRules.length).toBeGreaterThan(0);
        expect(rulesWithTruthFn.length).toBe(nalRules.length);
    });
});
