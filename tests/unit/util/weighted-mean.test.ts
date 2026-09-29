import { describe, expect, it } from 'vitest';
import { weightedMean } from '@senars/util';

describe('weightedMean', () => {
  it('is the exact mean when the prior weight is the sample index', () => {
    let mean = 0;
    for (let n = 0; n < 5; n++) mean = weightedMean(mean, n, 10);

    expect(mean).toBe(10);
  });

  it('averages unequal samples by count', () => {
    const samples = [1, 2, 3, 4];
    const mean = samples.reduce((acc, value, n) => weightedMean(acc, n, value), 0);

    expect(mean).toBe(2.5);
  });

  it('the first sample is the value itself', () => {
    expect(weightedMean(0, 0, 7)).toBe(7);
  });

  it('a retained weight of 9 is the 0.1-step decay', () => {
    let rate = 0.5;
    for (let i = 0; i < 100; i++) rate = weightedMean(rate, 9, 1);

    // 100 consecutive successes from a cold prior of 0.5 converge on 1 without
    // reaching it, which is what distinguishes the decay from a plain mean.
    expect(rate).toBeGreaterThan(0.99);
    expect(rate).toBeLessThan(1);
  });

  it('an unweighted first observation is not dragged toward a stale prior', () => {
    expect(weightedMean(0.42, 1, 0)).toBe(0.21);
  });
});
