import { bench } from 'vitest';
import { parseMeTTa } from '../src/parser/runtime.js';
import { createMeTTa } from '../src/runtime/builder.js';
import { sym, num, expr } from '../src/index.js';
import { hashAtom } from '../src/core/hash.js';
import { InMemorySpace } from '../src/core/space.js';

bench('parse: simple expression', () => {
  parseMeTTa('(+ 1 2)');
});

bench('parse: complex expression', () => {
  parseMeTTa(`
    (= (add $x $y) (+ $x $y))
    (= (mul $x $y) (* $x $y))
    (= (factorial 0) 1)
    (= (factorial $n) (* $n (factorial (- $n 1))))
  `);
});

bench('evaluate: arithmetic', () => {
  const runtime = createMeTTa();
  const program = expr(sym('+'), num(123), num(456));
  // Note: This is sync evaluation, in real benchmarks we'd use Effect.runSync
});

bench('hash: atoms', () => {
  hashAtom(expr(sym('+'), num(1), num(2)));
  hashAtom(expr(sym('+'), num(2), num(3)));
  hashAtom(expr(sym('*'), num(4), num(5)));
});

bench('space: add and query', () => {
  const space = new InMemorySpace('bench');
  for (let i = 0; i < 1000; i++) {
    space.add(expr(sym('fact'), num(i)));
  }
  const results = [...space.query(sym('fact'))];
});