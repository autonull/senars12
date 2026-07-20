import {
  Bag,
  Memory,
  RuleProcessor,
  Stamp,
  TermBuilder,
  Truth,
  atom,
  createMinimalNAR,
  createTask,
  termsEqual,
} from '../../nar/src';
import { fromNarsese, serializeTerm } from '../../nar/src/terms';

function time(name: string, iterations: number, fn: (i: number) => void): number {
  for (let i = 0; i < Math.min(100, iterations); i++) fn(i);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn(i);
  const elapsed = performance.now() - start;
  const perOp = (elapsed * 1000) / iterations;
  console.log(`${name}: ${perOp.toFixed(2)}ns per operation (${iterations} iterations)`);
  return perOp;
}

describe('Performance benchmarks (infrastructure)', () => {
  test('inference cycle throughput', () => {
    const nar = createMinimalNAR();
    const term = TermBuilder.inheritance(atom('cat'), atom('animal'));
    const iterations = 500;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      nar.inputTask(createTask(term, 'belief', Truth.TRUE));
    }
    const elapsed = performance.now() - start;
    const perOp = (elapsed * 1000) / iterations;
    console.log(
      `Inference cycle (inputTask): ${perOp.toFixed(2)}μs per operation (${iterations} iterations)`
    );
    expect(perOp).toBeLessThan(5000);
  });

  test('rule matching throughput', () => {
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
    for (let i = 0; i < 100; i++) processor.processSync(t1, t2);
    const start = performance.now();
    for (let i = 0; i < iterations; i++) processor.processSync(t1, t2);
    const elapsed = performance.now() - start;
    const perOp = (elapsed * 1000) / iterations;
    console.log(`Rule matching: ${perOp.toFixed(2)}μs per operation (${iterations} iterations)`);
    expect(perOp).toBeLessThan(500);
  });

  test('memory bag operations', () => {
    const bag = new Bag<number>(1000);
    const addNs = time('Bag.add', 10000, (i) => bag.add(i, Math.random()));
    expect(addNs).toBeLessThan(100000);
    const peek = bag.peek();
    expect(typeof peek === 'number').toBe(true);
  });

  test('serialization round-trip (terms)', () => {
    const term = TermBuilder.inheritance(atom('cat'), atom('animal'));
    const s = serializeTerm(term);
    const roundNs = time('Term serialize/deserialize round-trip', 5000, () => {
      const parsed = fromNarsese(s);
      if (!parsed || !termsEqual(parsed, term)) throw new Error('round-trip mismatch');
    });
    expect(roundNs).toBeLessThan(100000);
  });

  test('memory serialize/deserialize', async () => {
    const { deserialize, serialize } = await import('../../nar/src/memory/state/serialization');
    const memory = new Memory();
    memory.addTask(
      {
        term: TermBuilder.inheritance(atom('cat'), atom('animal')),
        truth: Truth.TRUE,
        stamp: Stamp.createInput(),
      },
      'belief'
    );
    const iterations = 200;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const state = serialize(memory);
      await deserialize(state, memory);
    }
    const elapsed = performance.now() - start;
    const perOp = (elapsed * 1000) / iterations;
    console.log(
      `Memory serialize/deserialize: ${perOp.toFixed(2)}μs per operation (${iterations} iterations)`
    );
    expect(perOp).toBeLessThan(50000);
  });
});
