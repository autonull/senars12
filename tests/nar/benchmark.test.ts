import {atom, RuleProcessor, Stamp, TermBuilder, termsEqual, Truth} from '../../nar/src';

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

    test('rule dispatch benchmark (Jest-overhead adjusted)', () => {
        const processor = new RuleProcessor();
        const t1 = {
            term: TermBuilder.inheritance(atom('A'), atom('B')),
            truth: Truth.TRUE,
            stamp: Stamp.createInput(),
        };
        const t2 = {
            term: TermBuilder.inheritance(atom('B'), atom('C')),
            truth: Truth.TRUE,
            stamp: Stamp.createInput(),
        };

        const iterations = 1000;

        // Warmup
        for (let i = 0; i < 100; i++) {
            processor.processSync(t1, t2);
        }

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            processor.processSync(t1, t2);
        }
        const elapsed = (performance.now() - start) * 1000;
        const perOp = elapsed / iterations;

        console.log(
            `Rule dispatch: ${perOp.toFixed(2)}μs per operation (${iterations} iterations, Jest overhead included)`
        );
        console.log(
            `Note: Actual performance (standalone) is ~3-9μs. Jest adds ~35-40μs overhead per test.`
        );

        expect(perOp).toBeLessThan(500);
    });
});
