import {describe, expect, test} from '@jest/globals';
import {TermBuilder} from '../../src/nar/terms';
import {NALExtendedRules} from '../../src/nar/rules';

describe('NAL7 Temporal Rules', () => {
    const {inheritance, sequence, parallel, predictive, atom} = TermBuilder;

    describe('sequenceIntroduction', () => {
        test('creates sequence from two inheritances with same subject', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const living = atom('living');
            const inh1 = inheritance(bird, animal);
            const inh2 = inheritance(bird, living);

            const result = NALExtendedRules.sequenceIntroduction([inh1, inh2]);

            expect(result).toBeDefined();
            expect(result?.toString()).toBe('(bird --> (animal ,/ living))');
        });

        test('returns undefined for different subjects', () => {
            const bird = atom('bird');
            const cat = atom('cat');
            const animal = atom('animal');
            const living = atom('living');
            const inh1 = inheritance(bird, animal);
            const inh2 = inheritance(cat, living);

            const result = NALExtendedRules.sequenceIntroduction([inh1, inh2]);
            expect(result).toBeUndefined();
        });
    });

    describe('parallelIntroduction', () => {
        test('creates parallel from two inheritances with same subject', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const living = atom('living');
            const inh1 = inheritance(bird, animal);
            const inh2 = inheritance(bird, living);

            const result = NALExtendedRules.parallelIntroduction([inh1, inh2]);

            expect(result).toBeDefined();
            expect(result?.toString()).toBe('(bird --> (animal || living))');
        });

        test('returns undefined for different subjects', () => {
            const bird = atom('bird');
            const cat = atom('cat');
            const inh1 = inheritance(bird, atom('animal'));
            const inh2 = inheritance(cat, atom('living'));

            const result = NALExtendedRules.parallelIntroduction([inh1, inh2]);
            expect(result).toBeUndefined();
        });
    });

    describe('predictiveImplication', () => {
        test('creates predictive implication from sequence and inheritance', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const seq = sequence(bird, animal);
            const inh = inheritance(bird, animal);

            const result = NALExtendedRules.predictiveImplication([seq, inh]);

            expect(result).toBeDefined();
            expect(result?.toString()).toBe('(bird /> animal)');
        });

        test('returns undefined when sequence does not match inheritance', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const cat = atom('cat');
            const seq = sequence(bird, animal);
            const inh = inheritance(cat, atom('living'));

            const result = NALExtendedRules.predictiveImplication([seq, inh]);
            expect(result).toBeUndefined();
        });
    });

    describe('temporalDeduction', () => {
        test('derives inheritance from predictive and sequence', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const pred = predictive(bird, animal);
            const seq = sequence(bird, animal);

            const result = NALExtendedRules.temporalDeduction([pred, seq]);

            expect(result).toBeDefined();
            expect(result?.toString()).toBe('(bird --> animal)');
        });

        test('returns undefined when predictive and sequence do not match', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const cat = atom('cat');
            const pred = predictive(bird, animal);
            const seq = sequence(cat, atom('living'));

            const result = NALExtendedRules.temporalDeduction([pred, seq]);
            expect(result).toBeUndefined();
        });
    });

    describe('temporal term creation', () => {
        test('creates sequence terms', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const seq = sequence(bird, animal);

            expect(seq.toString()).toBe('(bird ,/ animal)');
        });

        test('creates parallel terms', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const par = parallel(bird, animal);

            expect(par.toString()).toBe('(animal || bird)');
        });

        test('creates predictive terms', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const pred = predictive(bird, animal);

            expect(pred.toString()).toBe('(bird /> animal)');
        });

        test('handles undefined input gracefully', () => {
            const seq = sequence(undefined!, undefined!);
            const par = parallel(undefined!, undefined!);
            const pred = predictive(undefined!, undefined!);

            expect(seq.toString()).toBe('TRUE');
            expect(par.toString()).toBe('TRUE');
            expect(pred.toString()).toBe('TRUE');
        });
    });
});
