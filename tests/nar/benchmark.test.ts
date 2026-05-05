import { atom, termsEqual } from '../../src/nar/terms/types.js';
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

test('rule dispatch benchmark <2μs', () => {
  const processor = new RuleProcessor();
  const t1 = atom('A');
  const t2 = atom('B');

  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    processor.processSync(t1, t2);
  }
  const elapsed = (performance.now() - start) * 1000;
  const perOp = elapsed / 1000;

  console.log(`Rule dispatch: ${perOp.toFixed(2)}μs per operation`);
  expect(perOp).toBeLessThan(2);
});

    test('NAR example runs', async () => {
        const nar = new NAR();

        await nar.input('bird', 'belief');
        await nar.input('swan', 'belief');
        await nar.input('$x --> bird', 'belief');
        await nar.input('swan --> $x', 'belief');

        const derived = await nar.run(10);

        console.log(`NAR derived ${derived} new beliefs`);
        expect(nar.memory.size).toBeGreaterThan(0);
    });
});