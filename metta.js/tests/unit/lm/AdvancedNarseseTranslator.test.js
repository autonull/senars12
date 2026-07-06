/**
 * @file tests/unit/lm/AdvancedNarseseTranslator.test.js
 * @description Unit tests for AdvancedNarseseTranslator
 */

import {AdvancedNarseseTranslator} from '@senars/core/src/lm/index';

describe('AdvancedNarseseTranslator', () => {
    let translator;

    beforeEach(() => {
        translator = new AdvancedNarseseTranslator();
    });

    describe('Narsese to Natural Language Translation', () => {
        test.each([
            {input: '(cat --> animal).', expected: 'cat is a animal'},
            {input: '(cat <-> dog).', expected: 'cat is similar to dog'},
            {input: '(rainy ==> wet).', expected: 'if rainy then wet'}
        ])('translates $input to $expected', ({input, expected}) => {
            const result = translator.fromNarsese(input);
            expect(result.text).toBe(expected);
            expect(result.confidence).toBeGreaterThan(0.8);
        });

        test('should return original with low confidence for invalid Narsese', () => {
            expect(translator.fromNarsese('invalid narsese')).toMatchObject({
                text: 'invalid narsese',
                confidence: 0.2
            });
        });
    });

    describe('Natural Language to Narsese Translation', () => {
        test.each([
            {input: 'cat is a animal', expected: '(cat --> animal).'},
            {input: 'cat and dog', expected: '(&, cat, dog).'},
            {input: 'cat or dog', expected: '(|, cat, dog).'}
        ])('translates $input to $expected', ({input, expected}) => {
            const result = translator.toNarsese(input);
            expect(result.narsese).toBe(expected);
            expect(result.confidence).toBeGreaterThan(0.8);
        });

        test('should handle basic text with fallback', () => {
            const result = translator.toNarsese('simple statement');
            expect(result.narsese).toContain('-->');
            expect(result.confidence).toBe(0.3);
        });
    });

    describe('Context and Quality Features', () => {
        test('should add context correctly', () => {
            const initialLength = translator.contextBuffer.length;
            translator.addContext('test context');
            expect(translator.contextBuffer).toHaveLength(initialLength + 1);
            expect(translator.contextBuffer[translator.contextBuffer.length - 1]).toBe('test context');
        });

        test('should maintain context buffer size limit', () => {
            Array.from({length: 15}).forEach((_, i) => translator.addContext(`context ${i}`));
            expect(translator.contextBuffer).toHaveLength(translator.maxContextSize);
        });

        test('should provide quality metrics', () => {
            translator.toNarsese('test 1');
            translator.fromNarsese('<test --> example>.');

            expect(translator.getQualityMetrics()).toMatchObject({
                totalTranslations: expect.any(Number),
                averageConfidence: expect.any(Number),
                highConfidenceRate: expect.any(Number),
                lowConfidenceRate: expect.any(Number)
            });
        });

        test('should validate semantic preservation', () => {
            expect(translator.validateSemanticPreservation(
                'cats are animals',
                '<cats --> animals>.',
                'cats are animals'
            )).toMatchObject({
                similar: true,
                preserved: true,
                similarity: expect.any(Number)
            });
        });
    });

    describe('Error Correction', () => {
        test('should add punctuation if missing', () => {
            expect(translator.applyErrorCorrection({narsese: '(cat --> animal)', confidence: 0.9}))
                .toMatchObject({narsese: '(cat --> animal).'});
        });

        test('should identify empty parentheses', () => {
            const result = translator.applyErrorCorrection({narsese: '()', confidence: 0.9});
            expect(result.confidence).toBeLessThanOrEqual(0.3);
        });
    });

    describe('Iterative Translation', () => {
        test('should return initial result for high confidence translations', async () => {
            const result = await translator.iterativeTranslate('cat is a animal');
            expect(result.narsese).toBe('(cat --> animal).');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        test('should return refinement note for low confidence translations', async () => {
            const result = await translator.iterativeTranslate('very ambiguous input');
            expect(result.confidence).toBe(0.3);
            expect(result.notes).toContain('Low confidence');
        });
    });
});
