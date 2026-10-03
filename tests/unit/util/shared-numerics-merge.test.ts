import { deepFreeze, deepMerge, finiteOr, sigmoid, softmax, toFiniteNumber } from '@senars/util';
import { describe, expect, it } from 'vitest';

describe('sigmoid', () => {
  it('maps the real line monotonically onto (0, 1)', () => {
    expect(sigmoid(0)).toBe(0.5);
    expect(sigmoid(-40)).toBeLessThan(1e-15);
    expect(sigmoid(40)).toBeGreaterThan(1 - 1e-15);
    expect(sigmoid(1)).toBeGreaterThan(sigmoid(0));
  });
});

describe('softmax', () => {
  it('returns a normalized distribution', () => {
    const probs = softmax([1, 2, 3]);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(probs[2]).toBeGreaterThan(probs[1]!);
    expect(probs[1]).toBeGreaterThan(probs[0]!);
  });

  it('is shift-invariant, so large logits do not overflow', () => {
    const base = softmax([1, 2, 3]);
    softmax([1001, 1002, 1003]).forEach((p, i) => {
      expect(p).toBeCloseTo(base[i]!, 10);
    });
  });

  it('is uniform over equal inputs', () => {
    softmax([5, 5, 5, 5]).forEach((p) => {
      expect(p).toBeCloseTo(0.25, 12);
    });
  });

  it('handles an empty input', () => {
    expect(softmax([])).toEqual([]);
  });

  it('collapses to a one-hot at an extreme separation', () => {
    const probs = softmax([0, 1000]);
    expect(probs[1]).toBeCloseTo(1, 10);
    expect(probs[0]).toBeCloseTo(0, 10);
  });

  it('stays finite for all-negative scores', () => {
    const probs = softmax([-1000, -1001]);
    expect(probs.every(Number.isFinite)).toBe(true);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
});

describe('deepMerge', () => {
  it('merges nested plain objects key-by-key', () => {
    const base = { a: { b: 1, c: 2 }, d: 3 };
    expect(deepMerge(base, { a: { c: 9 } })).toEqual({ a: { b: 1, c: 9 }, d: 3 });
  });

  it('replaces arrays wholesale rather than interleaving them', () => {
    expect(deepMerge({ list: [1, 2, 3] }, { list: [9] })).toEqual({ list: [9] });
  });

  it('skips undefined overrides so a partial cannot erase a default', () => {
    expect(deepMerge({ a: 1, b: 2 }, { a: undefined })).toEqual({ a: 1, b: 2 });
  });

  it('adds keys absent from the base', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('does not mutate the base', () => {
    const base = { a: { b: 1 } };
    deepMerge(base, { a: { b: 2 } });
    expect(base.a.b).toBe(1);
  });

  it('lets a primitive override replace an object wholesale', () => {
    expect(deepMerge({ a: { b: 1 } }, { a: 5 })).toEqual({ a: 5 });
  });

  it('shares no branch with the base, at any depth the override does not reach', () => {
    const base = deepFreeze({ touched: { n: 1 }, untouched: { deep: { n: 2 } } });
    const merged = deepMerge(base, { touched: { n: 9 } });

    expect(merged).toEqual({ touched: { n: 9 }, untouched: { deep: { n: 2 } } });
    expect(merged.untouched).not.toBe(base.untouched);
    expect(merged.untouched.deep).not.toBe(base.untouched.deep);
    merged.untouched.deep.n = 3;
    expect(base.untouched.deep.n).toBe(2);
  });
});

describe('toFiniteNumber', () => {
  it('passes finite numbers through unchanged', () => {
    expect(toFiniteNumber(0)).toBe(0);
    expect(toFiniteNumber(-1.5)).toBe(-1.5);
  });

  it('parses numeric strings, including fractions', () => {
    expect(toFiniteNumber('1.5')).toBe(1.5);
    expect(toFiniteNumber(' 42 ')).toBe(42);
    expect(toFiniteNumber('-0.25')).toBe(-0.25);
  });

  it('rejects values that survive arithmetic as NaN or Infinity', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])
      expect(toFiniteNumber(bad)).toBeUndefined();
    for (const bad of ['abc', '1,5', 'Infinity', '-Infinity', '0x'])
      expect(toFiniteNumber(bad)).toBeUndefined();
  });

  it('treats an absent value as absent, not as zero', () => {
    // Number(null), Number([]), and Number('') are all 0, which made a missing
    // setting indistinguishable from a setting of zero.
    for (const absent of [undefined, null, '', '   ', [], {}, true, false])
      expect(toFiniteNumber(absent)).toBeUndefined();
  });

  it('finiteOr substitutes the fallback only when the value is not finite', () => {
    expect(finiteOr('7', 1)).toBe(7);
    expect(finiteOr('nope', 1)).toBe(1);
    expect(finiteOr(Number.NaN, 1)).toBe(1);
    expect(finiteOr(0, 1)).toBe(0);
  });
});
