import { atom, termsEqual } from '../terms/types.js';
import { TermFactory } from '../terms/factory.js';
import { RuleProcessor } from '../rules/processor.js';
import { NAR } from '../nar.js';

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

    test('rule dispatch benchmark <20μs', () => {
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
        expect(perOp).toBeLessThan(20);
    });
});
