import {clamp, computeHash, ensureArray, fnv1a, isNil, makeId, safeDiv} from '../../../src/nar/utils';

describe('Utility Functions', () => {
  describe('clamp', () => {
    test.each`
      value   | min | max | expected
      ${0.5}  | ${0} | ${1} | ${0.5}
      ${-0.5} | ${0} | ${1} | ${0}
      ${1.5}  | ${0} | ${1} | ${1}
      ${0}    | ${0} | ${1} | ${0}
      ${1}    | ${0} | ${1} | ${1}
      ${10}   | ${5} | ${15} | ${10}
      ${3}    | ${5} | ${10} | ${5}
      ${12}   | ${5} | ${10} | ${10}
    `('clamps $value to [$min, $max] = $expected', ({value, min, max, expected}) => {
      expect(clamp(value, min, max)).toBe(expected);
    });

    test('handles NaN', () => {
      expect(clamp(NaN, 0, 1)).toBeNaN();
    });

    test('handles Infinity', () => {
      expect(clamp(Infinity, 0, 1)).toBe(1);
      expect(clamp(-Infinity, 0, 1)).toBe(0);
    });
  });

  describe('safeDiv', () => {
    test.each`
      numerator | denominator | expected
      ${0.5} | ${2} | ${0.25}
      ${1.0} | ${2} | ${0.5}
      ${5} | ${2} | ${1}
      ${0.8} | ${0.8} | ${1}
      ${0.0} | ${5} | ${0}
      ${0.5} | ${0} | ${0}
      ${10} | ${0} | ${0}
    `('divides $numerator / $denominator = $expected', ({numerator, denominator, expected}) => {
      expect(safeDiv(numerator, denominator)).toBeCloseTo(expected);
    });

    test('handles edge cases', () => {
      expect(safeDiv(-0.5, 2)).toBeGreaterThanOrEqual(0);
      expect(safeDiv(1000000, 2)).toBe(1);
      expect(safeDiv(0, 0)).toBe(0);
    });
  });

  describe('makeId', () => {
    test('creates unique ids', () => {
      expect(makeId()).not.toBe(makeId());
    });

    test('creates valid UUIDs', () => {
      expect(makeId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    test.each([10, 100, 1000])('creates %d unique ids', (count) => {
      const ids = new Set(Array.from({length: count}, () => makeId()));
      expect(ids.size).toBe(count);
    });

    test('format is consistent across many iterations', () => {
      for (let i = 0; i < 100; i++) {
        expect(makeId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      }
    });
  });

  describe('isNil', () => {
    test.each`
      value | expected
      ${null} | ${true}
      ${undefined} | ${true}
      ${0} | ${false}
      ${''} | ${false}
      ${false} | ${false}
      ${NaN} | ${false}
      ${'null'} | ${false}
      ${'undefined'} | ${false}
    `('isNil($value) = $expected', ({value, expected}) => {
      expect(isNil(value)).toBe(expected);
    });

    test('handles complex objects', () => {
      expect(isNil({})).toBe(false);
      expect(isNil([])).toBe(false);
      expect(isNil(new Object())).toBe(false);
      expect(isNil({key: 'value'})).toBe(false);
    });
  });

  describe('ensureArray', () => {
    test.each`
      input | expected
      ${'a'} | ${['a']}
      ${1} | ${[1]}
      ${true} | ${[true]}
      ${null} | ${[]}
      ${undefined} | ${[]}
      ${'test'} | ${['test']}
    `('wraps single value $input to array', ({input, expected}) => {
      expect(ensureArray(input)).toEqual(expected);
    });

    test.each`
      input | expected
      ${['a', 'b']} | ${['a', 'b']}
      ${[1, 2, 3]} | ${[1, 2, 3]}
      ${[]} | ${[]}
      ${[null]} | ${[null]}
    `('passes array through', ({input, expected}) => {
      expect(ensureArray(input)).toEqual(expected);
    });

    test('handles objects and functions', () => {
      const obj = {key: 'value'};
      const fn = () => {};
      expect(ensureArray(obj)).toEqual([obj]);
      expect(ensureArray(fn)).toEqual([fn]);
    });
  });

  describe('fnv1a hash', () => {
    test.each(['test', 'hello', 'world', '', 'special!@#$%', '123456'])(
      'is deterministic for "%s"',
      (input) => {
        expect(fnv1a(input)).toBe(fnv1a(input));
      }
    );

    test.each`
      input1 | input2
      ${'Test'} | ${'test'}
      ${'TEST'} | ${'test'}
      ${'a'} | ${'b'}
      ${'long string'} | ${'longer string'}
    `('different hashes for different inputs', ({input1, input2}) => {
      expect(fnv1a(input1)).not.toBe(fnv1a(input2));
    });

    test('produces positive hashes', () => {
      ['test', 'hello', 'world', '123', 'special!@#', ''].forEach((input) => {
        expect(fnv1a(input)).toBeGreaterThan(0);
      });
    });

    test('is case sensitive', () => {
      expect(fnv1a('Test')).not.toBe(fnv1a('test'));
      expect(fnv1a('TEST')).not.toBe(fnv1a('test'));
      expect(fnv1a('Test')).not.toBe(fnv1a('TEST'));
    });

    test('handles unicode characters', () => {
      expect(fnv1a('你好')).toBeDefined();
      expect(fnv1a('🚀')).toBeDefined();
      expect(fnv1a('你好')).not.toBe(fnv1a('world'));
    });
  });

  describe('computeHash', () => {
    test.each`
      operator | args
      ${'test'} | ${[1, 2, 3]}
      ${'inheritance'} | ${[1, 2]}
      ${'similarity'} | ${[3, 2, 1]}
      ${'conjunction'} | ${[5, 1, 3]}
    `('computes hash for $operator with args', ({operator, args}) => {
      const hash = computeHash(operator, args);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThan(0);
    });

    test.each`
      operator | args1 | args2
      ${'similarity'} | ${[1, 2, 3]} | ${[3, 2, 1]}
      ${'conjunction'}| ${[5, 1, 3]} | ${[3, 5, 1]}
    `('sorts args for commutative $operator', ({operator, args1, args2}) => {
      expect(computeHash(operator, args1)).toBe(computeHash(operator, args2));
    });

    test.each`
      operator | args1 | args2
      ${'inheritance'} | ${[1, 2, 3]} | ${[3, 2, 1]}
      ${'implication'} | ${[1, 2]} | ${[2, 1]}
    `('preserves order for non-commutative $operator', ({operator, args1, args2}) => {
      expect(computeHash(operator, args1)).not.toBe(computeHash(operator, args2));
    });

    test('is deterministic', () => {
      expect(computeHash('test', [1, 2, 3])).toBe(computeHash('test', [1, 2, 3]));
      expect(computeHash('test', [1, 2, 3])).not.toBe(computeHash('test', [3, 2, 1]));
    });

    test('handles empty args', () => {
      expect(computeHash('test', [])).toBeDefined();
      expect(computeHash('test', [])).toBeGreaterThan(0);
    });
  });

  describe('hash invariants', () => {
    test('same input produces same hash', () => {
      ['test', 'hello', '', 'special!@#', '123'].forEach((input) => {
        const hashes = Array.from({length: 10}, () => fnv1a(input));
        expect(new Set(hashes).size).toBe(1);
      });
    });

    test('different inputs produce different hashes', () => {
      const inputs = ['a', 'b', 'c', 'd', 'e'];
      const hashes = inputs.map((input) => fnv1a(input));
      expect(new Set(hashes).size).toBe(inputs.length);
    });

    test('hash distribution is reasonable', () => {
      const count = 1000;
      const hashes = Array.from({length: count}, (_, i) => fnv1a(`input${i}`));
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBeGreaterThan(count * 0.9);
    });
  });
});
