import { deepMerge, sigmoid, softmax } from '@senars/util';
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
});
