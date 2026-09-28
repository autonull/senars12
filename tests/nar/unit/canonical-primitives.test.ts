import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { deepEqual, stableStringify } from '@senars/util';
import { holdoutSplit, mulberry32 } from '../../../nar/src/utils/random.js';

describe('stableStringify', () => {
  it('is independent of key insertion order', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(stableStringify({ a: { d: 1, c: 2 } })).toBe(stableStringify({ a: { c: 2, d: 1 } }));
  });

  it('preserves array order and agrees with JSON.stringify on scalars', () => {
    expect(stableStringify([1, 2, 3])).toBe(JSON.stringify([1, 2, 3]));
    expect(stableStringify([2, 1])).not.toBe(stableStringify([1, 2]));
    expect(stableStringify('x')).toBe('"x"');
    expect(stableStringify(4)).toBe('4');
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(undefined)).toBe('null');
  });

  it('drops undefined members and serializes typed arrays by value', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(stableStringify(new Float32Array([0.5, 1.5]))).toBe('[0.5,1.5]');
  });
});

describe('deepEqual', () => {
  it('ignores key order and respects value and array order', () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('matches deepStrictEqual on nested structures', () => {
    const cases: [unknown, unknown][] = [
      [{ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }],
      [{ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] }],
      [new Float32Array([1, 2]), new Float32Array([1, 2])],
      [new Float32Array([1, 2]), new Float32Array([2, 1])],
    ];
    for (const [a, b] of cases) {
      expect(deepEqual(a, b)).toBe(isDeepStrictEqual(a, b));
    }
  });
});

describe('holdoutSplit', () => {
  const items = Array.from({ length: 20 }, (_, i) => i);

  it('partitions deterministically with the requested holdout size', () => {
    const { holdout, train } = holdoutSplit(items, 0.25, mulberry32(7));
    expect(holdout).toHaveLength(5);
    expect(train).toHaveLength(15);
    expect([...holdout, ...train].sort((a, b) => a - b)).toEqual(items);
  });

  it('is reproducible for a given seed and varies across seeds', () => {
    const a = holdoutSplit(items, 0.2, mulberry32(1));
    const b = holdoutSplit(items, 0.2, mulberry32(1));
    const c = holdoutSplit(items, 0.2, mulberry32(2));
    expect(a).toEqual(b);
    expect(a.holdout).not.toEqual(c.holdout);
  });

  it('always reserves at least one holdout row', () => {
    const { holdout, train } = holdoutSplit([1, 2, 3, 4], 0.01, mulberry32(3));
    expect(holdout).toHaveLength(1);
    expect(train).toHaveLength(3);
  });

  it('does not mutate its input', () => {
    const input = [...items];
    holdoutSplit(input, 0.5, mulberry32(5));
    expect(input).toEqual(items);
  });
});
