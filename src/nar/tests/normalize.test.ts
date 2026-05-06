import { TermFactory } from '../terms/factory.js';
import { normalize } from '../terms/normalize.js';
import { computeHash } from '../terms/types.js';

test('normalize sorts conjunction args and recomputes hash', () => {
  const a = TermFactory.atom('A');
  const b = TermFactory.atom('B');

  // create an intentionally malformed conjunction whose args are out-of-order
  const badHash = computeHash('conjunction', [b.hash, a.hash]);
  const malformed: any = { kind: 'conjunction', args: [b, a], hash: badHash };

  // Ensure the malformed term has args out of order compared to their hashes
  expect(malformed.args[0].hash).toBeGreaterThan(malformed.args[1].hash);

  const normalized = normalize(malformed);
  // args should be sorted by hash
  expect(normalized.args[0].hash).toBeLessThanOrEqual(normalized.args[1].hash);

  const expectedHash = computeHash('conjunction', normalized.args.map((t: any) => t.hash));
  expect(normalized.hash).toBe(expectedHash);
});
