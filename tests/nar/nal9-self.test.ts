import {describe, expect, test} from '@jest/globals';
import {NALExtendedRules, TermBuilder} from '../../src/nar';

describe('NAL9 Self/Control Rules', () => {
    const {inheritance, operation, predictive: _predictive, similarity, atom} = TermBuilder;

    describe('strategyEffectiveness', () => {
        test('evaluates strategy effectiveness', () => {
            const strategy = inheritance(atom('deduction'), atom('success'));
            const result = inheritance(atom('high'), atom('confidence'));

            const ruleResult = NALExtendedRules.strategyEffectiveness([strategy, result]);

            expect(ruleResult).toBeDefined();
            expect(ruleResult?.toString()).toContain('^');
        });

        test('returns undefined for non-inheritance', () => {
            const result = NALExtendedRules.strategyEffectiveness([atom('test'), atom('test')]);
            expect(result).toBeUndefined();
        });
    });

    describe('resourceAllocation', () => {
        test('allocates resources to task', () => {
            const task = inheritance(atom('task1'), atom('active'));
            const resource = inheritance(atom('cpu'), atom('available'));

            const ruleResult = NALExtendedRules.resourceAllocation([task, resource]);

            expect(ruleResult).toBeDefined();
            expect(ruleResult?.toString()).toContain('allocate');
        });

        test('returns undefined for invalid input', () => {
            const result = NALExtendedRules.resourceAllocation([atom('test'), atom('test')]);
            expect(result).toBeUndefined();
        });
    });

    describe('errorPatternDetection', () => {
        test('detects error patterns', () => {
            const error = inheritance(atom('context'), atom('error_occurred'));
            const context = inheritance(atom('situation'), atom('risky'));

            const ruleResult = NALExtendedRules.errorPatternDetection([error, context]);

            expect(ruleResult).toBeDefined();
            expect(ruleResult?.toString()).toContain('/>');
        });

        test('returns undefined for non-inheritance', () => {
            const result = NALExtendedRules.errorPatternDetection([atom('test'), atom('test')]);
            expect(result).toBeUndefined();
        });
    });

    describe('utilityEstimation', () => {
        test('estimates concept utility', () => {
            const concept = inheritance(atom('concept1'), atom('useful'));
            const utility = inheritance(atom('concept1'), atom('high_utility'));

            const ruleResult = NALExtendedRules.utilityEstimation([concept, utility]);

            expect(ruleResult).toBeDefined();
            expect(ruleResult?.toString()).toContain('utility');
        });

        test('returns undefined for invalid input', () => {
            const result = NALExtendedRules.utilityEstimation([atom('test'), atom('test')]);
            expect(result).toBeUndefined();
        });
    });

    describe('metacognitiveRevision', () => {
        test('performs metacognitive revision on matching beliefs', () => {
            const belief1 = inheritance(atom('x'), atom('y'));
            const belief2 = inheritance(atom('x'), atom('y'));

            const ruleResult = NALExtendedRules.metacognitiveRevision([belief1, belief2]);

            expect(ruleResult).toBeDefined();
            expect(ruleResult?.toString()).toContain('meta');
            expect(ruleResult?.toString()).toContain('revise');
        });

        test('returns undefined for non-matching beliefs', () => {
            const belief1 = inheritance(atom('x'), atom('y'));
            const belief2 = inheritance(atom('a'), atom('b'));

            const ruleResult = NALExtendedRules.metacognitiveRevision([belief1, belief2]);
            expect(ruleResult).toBeUndefined();
        });
    });

    describe('selfModelConsistency', () => {
        test('checks self-model consistency', () => {
            const model1 = inheritance(atom('self'), atom('belief1'));
            const model2 = inheritance(atom('self'), atom('belief2'));

            const ruleResult = NALExtendedRules.selfModelConsistency([model1, model2]);

            expect(ruleResult).toBeDefined();
            expect(ruleResult?.toString()).toContain('self');
            expect(ruleResult?.toString()).toContain('model');
        });

        test('returns undefined for different subjects', () => {
            const model1 = inheritance(atom('self1'), atom('belief'));
            const model2 = inheritance(atom('self2'), atom('belief'));

            const ruleResult = NALExtendedRules.selfModelConsistency([model1, model2]);
            expect(ruleResult).toBeUndefined();
        });
    });

    describe('metacognitive term creation', () => {
        test('creates operation terms for metacognition', () => {
            const meta = operation(atom('meta'), atom('analyze'));
            expect(meta.toString()).toBe('(meta ^ analyze)');
        });

        test('handles complex metacognitive structures', () => {
            const self = atom('self');
            const model = operation(atom('model'), self);
            const consistency = similarity(model, operation(atom('reality'), atom('check')));

            expect(consistency.toString()).toContain('<->');
        });
    });
});
