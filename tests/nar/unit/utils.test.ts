import {clamp, computeHash, ensureArray, fnv1a, isNil, makeId, safeDiv} from '../../../src/nar/utils';

describe('clamp', () => {
  test.each`
    value  | min    | max    | expected
    ${0.5} | ${0}   | ${1}   | ${0.5}
    ${-0.5}| ${0}   | ${1}   | ${0}
    ${1.5} | ${0}   | ${1}   | ${1}
    ${0}   | ${0}   | ${1}   | ${0}
    ${1}   | ${0}   | ${1}   | ${1}
    ${10}  | ${5}   | ${15}  | ${10}
    ${3}   | ${5}   | ${10}  | ${5}
    ${12}  | ${5}   | ${10}  | ${10}
  `('clamps $value to [$min, $max] = $expected', ({value, min, max, expected}) => {
    expect(clamp(value, min, max)).toBe(expected);
  });

  test('handles edge cases', () => {
    expect(clamp(NaN, 0, 1)).toBeNaN();
  });
});

describe('safeDiv', () => {
  test.each`
    numerator | denominator | expected
    ${0.5}    | ${2}        | ${0.25}
    ${1.0}    | ${2}        | ${0.5}
    ${5}      | ${2}        | ${1}
    ${0.8}    | ${0.8}      | ${1}
    ${0.0}    | ${5}        | ${0}
    ${0.5}    | ${0}        | ${0}
    ${10}     | ${0}        | ${0}
  `('divides $numerator / $denominator = $expected', ({numerator, denominator, expected}) => {
    expect(safeDiv(numerator, denominator)).toBeCloseTo(expected);
  });

  test('handles negative values', () => {
    expect(safeDiv(-0.5, 2)).toBeGreaterThanOrEqual(0);
  });

  test('handles very large values', () => {
    const result = safeDiv(1000000, 2);
    expect(result).toBe(1);
  });
});

describe('makeId', () => {
  test('creates unique ids', () => {
    const id1 = makeId();
    const id2 = makeId();
    expect(id1).not.toBe(id2);
  });

  test('creates valid UUIDs', () => {
    const id = makeId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test.each`
    count
    ${10}
    ${100}
    ${1000}
  `('creates $count unique ids', ({count}) => {
    const ids = new Set(Array.from({length: count}, () => makeId()));
    expect(ids.size).toBe(count);
  });

  test('id format is consistent', () => {
    for (let i = 0; i < 100; i++) {
      const id = makeId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });
});

describe('isNil', () => {
  test.each`
    value       | expected
    ${null}     | ${true}
    ${undefined}| ${true}
    ${0}        | ${false}
    ${''}       | ${false}
    ${false}    | ${false}
    ${NaN}      | ${false}
    ${'null'}   | ${false}
    ${'undefined'} | ${false}
  `('isNil($value) = $expected', ({value, expected}) => {
    expect(isNil(value)).toBe(expected);
  });

  test('handles object values', () => {
    expect(isNil({})).toBe(false);
    expect(isNil([])).toBe(false);
    expect(isNil(new Object())).toBe(false);
  });
});

describe('ensureArray', () => {
  test.each`
    input         | expected
    ${'a'}        | ${['a']}
    ${1}          | ${[1]}
    ${true}       | ${[true]}
    ${null}       | ${[]}
    ${undefined}  | ${[]}
    ${'test'}     | ${['test']}
  `('wraps single value $input to array', ({input, expected}) => {
    expect(ensureArray(input)).toEqual(expected);
  });

  test.each`
    input         | expected
    ${['a', 'b']} | ${['a', 'b']}
    ${[1, 2, 3]}  | ${[1, 2, 3]}
    ${[]}         | ${[]}
    ${[null]}     | ${[null]}
  `('passes array through', ({input, expected}) => {
    expect(ensureArray(input)).toEqual(expected);
  });

  test('handles objects correctly', () => {
    const obj = {key: 'value'};
    expect(ensureArray(obj)).toEqual([obj]);
  });
});

describe('fnv1a hash', () => {
  test.each`
    input
    ${'test'}
    ${'hello'}
    ${'world'}
    ${''}
    ${'special!@#$%'}
    ${'123456'}
  `('is deterministic for "$input"', ({input}) => {
    const h1 = fnv1a(input);
    const h2 = fnv1a(input);
    expect(h1).toBe(h2);
  });

  test.each`
    input1   | input2
    ${'Test'}| ${'test'}
    ${'TEST'}| ${'test'}
    ${'a'}   | ${'b'}
    ${'long string'} | ${'longer string'}
  `('produces different hashes for different inputs', ({input1, input2}) => {
    expect(fnv1a(input1)).not.toBe(fnv1a(input2));
  });

  test('produces positive hash values', () => {
    const inputs = ['test', 'hello', 'world', '123', 'special!@#', ''];
    inputs.forEach((input) => {
      expect(fnv1a(input)).toBeGreaterThan(0);
    });
  });

  test('is case sensitive', () => {
    expect(fnv1a('Test')).not.toBe(fnv1a('test'));
    expect(fnv1a('TEST')).not.toBe(fnv1a('test'));
  });
});

describe('computeHash', () => {
  test.each`
    operator    | args
    ${'test'}   | ${[1, 2, 3]}
    ${'inheritance'} | ${[1, 2]}
    ${'similarity'}  | ${[3, 2, 1]}
    ${'conjunction'} | ${[5, 1, 3]}
  `('computes hash for $operator with args', ({operator, args}) => {
    const hash = computeHash(operator, args);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('number');
    expect(hash).toBeGreaterThan(0);
  });

  test.each`
    operator     | args1        | args2
    ${'similarity'} | ${[1, 2, 3]} | ${[3, 2, 1]}
    ${'conjunction'}| ${[5, 1, 3]} | ${[3, 5, 1]}
  `('sorts args for commutative $operator', ({operator, args1, args2}) => {
    const h1 = computeHash(operator, args1);
    const h2 = computeHash(operator, args2);
    expect(h1).toBe(h2);
  });

  test.each`
    operator      | args1        | args2
    ${'inheritance'} | ${[1, 2, 3]} | ${[3, 2, 1]}
    ${'implication'} | ${[1, 2]}    | ${[2, 1]}
  `('preserves order for non-commutative $operator', ({operator, args1, args2}) => {
    const h1 = computeHash(operator, args1);
    const h2 = computeHash(operator, args2);
    expect(h1).not.toBe(h2);
  });

  test('combines multiple values consistently', () => {
    const h1 = computeHash('test', [1, 2, 3]);
    const h2 = computeHash('test', [1, 2, 3]);
    
    expect(h1).toBe(h2);
  });
});

describe('hash invariants', () => {
  test('same input always produces same hash', () => {
    const testCases = ['test', 'hello', '', 'special!@#', '123'];
    
    testCases.forEach((input) => {
      const hashes = Array.from({length: 10}, () => fnv1a(input));
      expect(new Set(hashes).size).toBe(1);
    });
  });

  test('different inputs produce different hashes', () => {
    const inputs = ['a', 'b', 'c', 'd', 'e'];
    const hashes = inputs.map((input) => fnv1a(input));
    
    expect(new Set(hashes).size).toBe(inputs.length);
  });
});
