import {describe, expect, test} from '@jest/globals';
import {TermBuilder} from '../../src/nar';
import {NALExtendedRules} from '../../src/nar';

describe('NAL2 Instance and Property Copula Rules', () => {
    const {inheritance, instance, property, atom} = TermBuilder;

    describe('instanceConversion', () => {
        test('converts inheritance to instance form', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const inh = inheritance(bird, animal);

            const result = NALExtendedRules.instanceConversion([inh, inh]);

            expect(result).toBeDefined();
            expect(result?.toString()).toBe('({bird} --> {animal})');
        });

        test('returns undefined for non-inheritance terms', () => {
            const result = NALExtendedRules.instanceConversion([atom('test'), atom('test')]);
            expect(result).toBeUndefined();
        });
    });

    describe('propertyConversion', () => {
        test('converts inheritance to property form', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const inh = inheritance(bird, animal);

            const result = NALExtendedRules.propertyConversion([inh, inh]);

            expect(result).toBeDefined();
            expect(result?.toString()).toBe('([bird] --> [animal])');
        });

        test('returns undefined for non-inheritance terms', () => {
            const result = NALExtendedRules.propertyConversion([atom('test'), atom('test')]);
            expect(result).toBeUndefined();
        });
    });

    describe('instanceDeduction', () => {
        test('applies instance deduction when subject matches', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const birdInst = instance(bird);
            const inh = inheritance(bird, animal);

            const result = NALExtendedRules.instanceDeduction([inh, birdInst]);

            expect(result).toBeDefined();
            expect(result?.toString()).toBe('(bird --> animal)');
        });

        test('returns undefined when subject does not match', () => {
            const bird = atom('bird');
            const cat = atom('cat');
            const animal = atom('animal');
            const catInst = instance(cat);
            const inh = inheritance(bird, animal);

            const result = NALExtendedRules.instanceDeduction([inh, catInst]);

            expect(result).toBeUndefined();
        });
    });

    describe('propertyInduction', () => {
        test('applies property induction when predicate matches', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const animalProp = property(animal);
            const inh = inheritance(bird, animal);

            const result = NALExtendedRules.propertyInduction([inh, animalProp]);

            expect(result).toBeDefined();
            expect(result?.toString()).toBe('(bird --> animal)');
        });

        test('returns undefined when predicate does not match', () => {
            const bird = atom('bird');
            const animal = atom('animal');
            const plant = atom('plant');
            const plantProp = property(plant);
            const inh = inheritance(bird, animal);

            const result = NALExtendedRules.propertyInduction([inh, plantProp]);

            expect(result).toBeUndefined();
        });
    });

    describe('instance and property term creation', () => {
        test('creates instance terms', () => {
            const bird = atom('bird');
            const birdInst = instance(bird);

            expect(birdInst.toString()).toBe('{bird}');
        });

        test('creates property terms', () => {
            const animal = atom('animal');
            const animalProp = property(animal);

            expect(animalProp.toString()).toBe('[animal]');
        });

        test('handles undefined input gracefully', () => {
            const birdInst = instance(undefined!);
            const animalProp = property(undefined!);

            expect(birdInst.toString()).toBe('TRUE');
            expect(animalProp.toString()).toBe('TRUE');
        });
    });
});
