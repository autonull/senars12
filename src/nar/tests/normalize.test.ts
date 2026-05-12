import {normalize, TermBuilder, termsEqual} from '../terms';

test('normalize sorts conjunction args', () => {
  const a = TermBuilder.atom('A');
  const b = TermBuilder.atom('B');

  const malformed: any = {kind: 'conjunction', args: [b, a]};

  const normalized = normalize(malformed);
  expect(termsEqual((normalized as any).args[0], a)).toBe(true);
  expect(termsEqual((normalized as any).args[1], b)).toBe(true);
});
