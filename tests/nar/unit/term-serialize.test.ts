import { describe, expect, test } from 'vitest';
import { TermBuilder, atom, termParser } from '../../../nar/src';

describe('term serialization', () => {
  test('negation serializes as unary prefix --b (not product (--b))', () => {
    // --b is unary negation; (--b) is a one-element product, so never emit parens.
    expect(TermBuilder.negation(atom('b')).toString()).toBe('--b');
  });

  test('negation round-trips through parser', () => {
    const s = TermBuilder.negation(atom('b')).toString();
    const parsed = termParser.parse(s);
    expect(parsed.toString()).toBe('--b');
  });

  test('negation nested in conjunction serializes with balanced parens', () => {
    const t = TermBuilder.inheritance(
      atom('a'),
      TermBuilder.conjunction(TermBuilder.negation(atom('b')), atom('c'))
    ) as Term;
    expect(t.toString()).toBe('(a --> (c & --b))');
  });
});