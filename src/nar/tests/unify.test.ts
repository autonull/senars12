import { TermFactory } from '../terms/factory.js';
import { unify } from '../terms/unifier.js';

test('unify binds variable and enforces consistency', () => {
  const A = TermFactory.atom('A');
  const B = TermFactory.atom('B');
  const x = TermFactory.atom('$x');

  const s1 = unify(x, A);
  expect(s1).toBeDefined();
  if (!s1) return;
  const binding = s1['$x'];
  expect(binding?.hash).toBe(A.hash);

  const s2 = unify(x, A, s1);
  expect(s2).toBeDefined();

  const s3 = unify(x, B, s1);
  expect(s3).toBeUndefined();
});
