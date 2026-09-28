import { describe, expect, it } from 'vitest';
import { clamp01, mean, pearson, percentile, stdDev, ucb1, variance } from '@senars/util';

describe('variance / stdDev / mean', () => {
  it('computes population moments', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(variance([1, 2, 3, 4])).toBeCloseTo(1.25);
    expect(stdDev([1, 2, 3, 4])).toBeCloseTo(Math.sqrt(1.25));
  });

  it('is zero for degenerate samples and projects values', () => {
    expect(variance([])).toBe(0);
    expect(variance([3])).toBe(0);
    expect(variance([5])).toBe(0);
    expect(mean([{ v: 2 }, { v: 4 }], (x) => x.v)).toBe(3);
    expect(stdDev([{ v: 2 }, { v: 4 }], (x) => x.v)).toBeCloseTo(1);
  });
});

describe('pearson', () => {
  it('is ±1 for perfect correlation and 0 for constant input', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
    expect(pearson([1], [2])).toBe(0);
  });

  it('matches the sum-of-products formulation', () => {
    const x = [0.5, 1.5, 2.5, 4];
    const y = [1, 0, 2, 3];
    const n = x.length;
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const sumX = sum(x);
    const sumY = sum(y);
    const sumXY = x.reduce((a, b, i) => a + b * (y[i] ?? 0), 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);
    const expected =
      (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
    expect(pearson(x, y)).toBeCloseTo(expected);
  });
});

describe('percentile', () => {
  it('reads the nearest-rank sample regardless of input order', () => {
    const values = [10, 1, 7, 3, 20];
    expect(percentile(values, 0)).toBe(1);
    expect(percentile(values, 1)).toBe(20);
    expect(percentile(values, 0.5)).toBe(7);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe('ucb1', () => {
  it('scores untried arms optimistically and decays with visits', () => {
    expect(ucb1(0, 0, 0, 1.4)).toBe(Number.POSITIVE_INFINITY);
    const first = ucb1(0.2, 1, 100, 1.4);
    const later = ucb1(0.2, 100, 100, 1.4);
    expect(first).toBeGreaterThan(later);
    expect(ucb1(0.5, 10, 100, 0)).toBe(0.5);
  });
});

describe('clamp01', () => {
  it('bounds to the unit interval', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(4)).toBe(1);
  });
});
