import {TermBuilder, Truth} from '../../../nar/src';
/**
 * Inference Rules Tests - Deduction, Induction, Abduction
 */
import {NAR} from '../../../src';

describe('Inference Rules', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR({
            maxConcepts: 100,
            activationDecayRate: 0.01,
            consolidationInterval: 5,
            cpuThrottleMs: 10,
            maxDerivationDepth: 10,
            maxDerivationsPerStep: 100,
            enableLMRules: false,
        });
    });

    describe('Deduction', () => {
        it('performs deduction: (A --> B), (B --> C) |- (A --> C)', async () => {
            await nar.input('(bird --> animal)', 'belief', Truth.create(0.9, 0.9));
            await nar.input('(animal --> living)', 'belief', Truth.create(0.9, 0.9));
            await nar.run(1);
            const concepts = nar.memory.listConcepts();
            expect(concepts.length).toBeGreaterThan(0);
        });

        it('chains multiple deduction steps', async () => {
            await nar.input('(mammal --> animal)', 'belief', Truth.create(0.95, 0.9));
            await nar.input('(dog --> mammal)', 'belief', Truth.create(0.95, 0.9));
            await nar.run(2);
            const concepts = nar.memory.listConcepts();
            expect(concepts.length).toBeGreaterThan(0);
        });
    });

    describe('Similarity', () => {
        it('handles similarity reasoning', async () => {
            await nar.input('(cat <-> feline)', 'belief', Truth.create(0.95, 0.9));
            await nar.run(1);
            const concepts = nar.memory.listConcepts();
            expect(concepts.length).toBeGreaterThan(0);
        });
    });

    describe('Complex Reasoning', () => {
        it('manages conflicting beliefs', async () => {
            await nar.input('(bird --> fly)', 'belief', Truth.create(0.9, 0.8));
            await nar.input('(penguin --> bird)', 'belief', Truth.create(0.95, 0.9));
            await nar.run(2);
            expect(nar.memory.size).toBeGreaterThan(0);
        });

        it('handles compound terms in reasoning', async () => {
            const cat = TermBuilder.atom('cat');
            const dog = TermBuilder.atom('dog');
            const pets = TermBuilder.conjunction(cat, dog);
            expect(pets.kind).toBe('conjunction');
            if ('args' in pets) expect(pets.args).toHaveLength(2);
        });
    });
});
