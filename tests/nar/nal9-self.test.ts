import {describe, expect, test} from '@jest/globals';
import {NALExtendedRules, TermBuilder} from '../../src/nar';

describe('NAL9 Self/Control Rules', () => {
    const {inheritance, operation, predictive: _predictive, similarity, atom} = TermBuilder;

    // DISABLED: BOT7 §1.1 — embeds operations in inheritance predicates
    describe('strategyEffectiveness', () => {
        test('is disabled to prevent operation misuse', () => {
            expect(NALExtendedRules.strategyEffectiveness).toBeUndefined();
        });
    });

    // DISABLED: BOT7 §1.1 — embeds operations in inheritance predicates
    describe('resourceAllocation', () => {
        test('is disabled to prevent operation misuse', () => {
            expect(NALExtendedRules.resourceAllocation).toBeUndefined();
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

    // DISABLED: BOT7 §1.1 — embeds operations in inheritance predicates
    describe('utilityEstimation', () => {
        test('is disabled to prevent operation misuse', () => {
            expect(NALExtendedRules.utilityEstimation).toBeUndefined();
        });
    });

    // DISABLED: BOT7 §1.1 — produces operations as subject/predicate
    describe('metacognitiveRevision', () => {
        test('is disabled to prevent operation misuse', () => {
            expect(NALExtendedRules.metacognitiveRevision).toBeUndefined();
        });
    });

    // DISABLED: BOT7 §1.1 — produces operations inside similarity
    describe('selfModelConsistency', () => {
        test('is disabled to prevent operation misuse', () => {
            expect(NALExtendedRules.selfModelConsistency).toBeUndefined();
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
