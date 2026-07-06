import {describe, expect, test} from '@jest/globals';
import {NarsGPTPrompts, PromptUtils} from '../../../../../src/reason/rules/lm/NarsGPTPrompts.js';

describe('NarsGPTPrompts', () => {
    describe('formatTruth', () => {
        test('formats positive truth correctly', () => {
            const truth = {f: 0.9, c: 0.8};
            const result = PromptUtils.formatTruth(truth);
            expect(result).toEqual({prefix: '', f: 0.9, c: 0.8});
        });

        test('formats negative truth correctly (f < 0.5)', () => {
            const truth = {f: 0.1, c: 0.9};
            const result = PromptUtils.formatTruth(truth);
            expect(result).toEqual({prefix: 'NOT: ', f: 0.9, c: 0.9});
        });

        test('handles missing properties', () => {
            const result = PromptUtils.formatTruth({});
            expect(result).toEqual({prefix: '', f: 0.5, c: 0});
        });
    });

    describe('formatBuffer', () => {
        test('formats list of tasks', () => {
            const buffer = [
                {term: 'bird', truth: {f: 0.9, c: 0.9}},
                {term: 'fish', truth: {f: 0.1, c: 0.8}} // Negative
            ];
            const output = NarsGPTPrompts.formatBuffer(buffer);
            expect(output).toContain('1. bird {0.90 0.90}');
            expect(output).toContain('2. NOT: fish {0.90 0.80}');
        });

        test('handles empty buffer', () => {
            const output = NarsGPTPrompts.formatBuffer([]);
            expect(output).toBe('(No relevant memory items found)');
        });
    });

    describe('Prompt Templates', () => {
        test('question prompt contains context and question', () => {
            const context = 'Context info';
            const question = 'Is it true?';
            const prompt = NarsGPTPrompts.question(context, question);
            expect(prompt).toContain(context);
            expect(prompt).toContain(question);
        });
    });
});
