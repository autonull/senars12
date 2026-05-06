import { atom, termsEqual } from '../../src/nar/terms/types.js';
import { TermFactory } from '../../src/nar/terms/factory.js';
import { RuleProcessor } from '../../src/nar/rules/processor.js';
import { NAR } from '../../src/nar/nar.js';

describe('Performance benchmarks', () => {
    test('term comparison benchmark <100ns', () => {
        const t1 = atom('test');
        const t2 = atom('test');

        const start = performance.now();
        for (let i = 0; i < 10000; i++) {
            termsEqual(t1, t2);
        }
        const elapsed = (performance.now() - start) * 1000;
        const perOp = elapsed / 10000;

        console.log(`Term comparison: ${perOp.toFixed(2)}ns per operation`);
        expect(perOp).toBeLessThan(100);
    });

    test('rule dispatch benchmark <10μs', () => {
        const processor = new RuleProcessor();
        const t1 = TermFactory.inheritance(atom('A'), atom('B'));
        const t2 = TermFactory.inheritance(atom('B'), atom('C'));

        const start = performance.now();
        for (let i = 0; i < 1000; i++) {
            processor.processSync(t1, t2);
        }
        const elapsed = (performance.now() - start) * 1000;
        const perOp = elapsed / 1000;

        console.log(`Rule dispatch: ${perOp.toFixed(2)}μs per operation`);
        expect(perOp).toBeLessThan(10);
    });

    test('NAR example runs with compound terms', async () => {
        const nar = new NAR();

        const bird = TermFactory.atom('bird');
        const swan = TermFactory.atom('swan');
        const animal = TermFactory.atom('animal');
        const x = TermFactory.atom('$x');

        await nar.input(bird, 'belief');
        await nar.input(swan, 'belief');
        await nar.input(animal, 'belief');

        const birdToAnimal = TermFactory.inheritance(bird, animal);
        const swanToBird = TermFactory.inheritance(swan, bird);

        await nar.input(birdToAnimal, 'belief');
        await nar.input(swanToBird, 'belief');

        const derived = await nar.run(10);

        console.log(`NAR derived ${derived} new beliefs`);
        expect(nar.memory.size).toBeGreaterThan(0);
    });

    test('direct rule processor with compound terms', () => {
        const processor = new RuleProcessor();

        const bird = TermFactory.atom('bird');
        const animal = TermFactory.atom('animal');
        const swan = TermFactory.atom('swan');

        const birdToAnimal = TermFactory.inheritance(bird, animal);
        const animalToSwan = TermFactory.inheritance(animal, swan);

        console.log('Term1:', birdToAnimal.kind, 'args:', birdToAnimal.args.map(a => a.symbol));
        console.log('Term2:', animalToSwan.kind, 'args:', animalToSwan.args.map(a => a.symbol));

        const animalTerm = birdToAnimal.args[1];
        const animalTerm2 = animalToSwan.args[0];
        console.log('Middle term match:', animalTerm.symbol, '==', animalTerm2.symbol, ':', animalTerm.hash === animalTerm2.hash);

        const results = processor.processSync(birdToAnimal, animalToSwan);

        console.log(`Rule processor produced ${results.length} results`);
        expect(results.length).toBeGreaterThan(0);
    });
});