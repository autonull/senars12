import { TermFactory } from '../terms/factory.js';
import { unify } from '../terms/unifier.js';

test('unify binds variable and enforces consistency', () => {
  const A = TermFactory.atom('A');
  const B = TermFactory.atom('B');
  const x = TermFactory.atom('$x');

  // bind $x -> A
  const s1 = unify(x, A);
  expect(s1).toBeDefined();
  expect(s1!['$x'].hash).toBe(A.hash);

  // unify again with same binding should succeed
  const s2 = unify(x, A, s1);
  expect(s2).toBeDefined();

  // unify with a different term should fail
  const s3 = unify(x, B, s1);
  expect(s3).toBeUndefined();
});
