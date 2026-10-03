import {
  clampSigned,
  decayCurve,
  flooredRatio,
  lerp,
  normalizeToSum,
  perSecond,
  renormalize,
  safeRatio,
  saturationRamp,
  softSquash,
  sumBy,
} from '@senars/util';
import { describe, expect, it } from 'vitest';

describe('clampSigned', () => {
  it('keeps the sign, which is the whole point over clamp01', () => {
    expect(clampSigned(-0.5)).toBe(-0.5);
    expect(clampSigned(0.5)).toBe(0.5);
    expect(clampSigned(-4)).toBe(-1);
    expect(clampSigned(4)).toBe(1);
  });

  it('takes the bound as a parameter', () => {
    expect(clampSigned(-4, 10)).toBe(-4);
    expect(clampSigned(-4, 0.25)).toBe(-0.25);
  });

  it('is the identity on a value already inside the band', () => {
    for (const v of [-1, -0.001, 0, 0.001, 1]) expect(clampSigned(v)).toBe(v);
  });
});

describe('lerp', () => {
  it('matches the convex-combination form it replaced', () => {
    for (const alpha of [0, 0.1, 0.5, 0.9, 1]) {
      expect(lerp(2, 6, alpha)).toBeCloseTo((1 - alpha) * 2 + alpha * 6, 12);
    }
  });

  it('endpoints and midpoint', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it('extrapolates past the endpoints, so it can overshoot on purpose', () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });
});

describe('saturationRamp', () => {
  it('rises monotonically and saturates below 1', () => {
    expect(saturationRamp(0, 5)).toBe(0);
    expect(saturationRamp(5, 5)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(saturationRamp(50, 5)).toBeLessThan(1);
    expect(saturationRamp(500, 5)).toBeGreaterThan(saturationRamp(50, 5));
  });

  it('reaches 1 for any positive amount once the scale degenerates to 0', () => {
    expect(saturationRamp(1, 0)).toBe(1);
    expect(saturationRamp(0, 0)).toBe(0);
    expect(saturationRamp(-1, 0)).toBe(0);
  });

  it('inverts decayCurve: the ramp of a decayed curve recovers its share', () => {
    const initial = 0.9;
    const rate = 0.3;
    for (const elapsed of [0, 1, 10, 100]) {
      const share = saturationRamp(elapsed * rate, 1);
      expect(decayCurve(initial, rate, elapsed)).toBeCloseTo(initial * (1 - share), 12);
    }
  });
});

describe('decayCurve', () => {
  it('starts at the initial value and never rises', () => {
    expect(decayCurve(0.8, 0.3, 0)).toBe(0.8);
    expect(decayCurve(0.8, 0.3, 1)).toBeLessThan(0.8);
    expect(decayCurve(0.8, 0.3, 1000)).toBeCloseTo(0, 12);
  });

  it('a zero rate holds, a negative rate grows', () => {
    expect(decayCurve(0.5, 0, 100)).toBe(0.5);
    expect(decayCurve(0.5, -0.1, 1)).toBeGreaterThan(0.5);
  });
});

describe('safeRatio', () => {
  it('divides, and answers the empty case from the parameter', () => {
    expect(safeRatio(3, 4)).toBe(0.75);
    expect(safeRatio(3, 0)).toBe(0);
    expect(safeRatio(3, 0, 0.5)).toBe(0.5);
    expect(safeRatio(0, 0, 1)).toBe(1);
  });

  it('treats a negative denominator as empty, not as a signed rate', () => {
    expect(safeRatio(3, -4)).toBe(0);
    expect(safeRatio(3, -4, 0.5)).toBe(0.5);
  });
});

describe('flooredRatio', () => {
  it('divides by the population when there is one', () => {
    expect(flooredRatio(3, 4)).toBe(0.75);
    expect(flooredRatio(0, 0)).toBe(0);
  });

  it('floors the denominator rather than calling the rate unmeasurable', () => {
    // The whole reason this is not safeRatio: an empty population is 0% used,
    // not an absent measurement.
    expect(safeRatio(3, 0, 0.5)).toBe(0.5);
    expect(flooredRatio(3, 0)).toBe(3);
  });

  it('takes the floor as a parameter, for a ratio over a smaller space', () => {
    expect(flooredRatio(2, 1, 10)).toBe(0.2);
  });
});

describe('perSecond', () => {
  it('normalizes an elapsed duration in ms to a per-second rate', () => {
    expect(perSecond(60, 1000)).toBeCloseTo(60, 12);
    expect(perSecond(60, 500)).toBeCloseTo(120, 12);
    expect(perSecond(1, 250)).toBeCloseTo(4, 12);
  });

  it('reports the empty answer rather than infinity at the first sample', () => {
    expect(perSecond(5, 0)).toBe(0);
    expect(perSecond(5, 0, -1)).toBe(-1);
  });
});

describe('softSquash', () => {
  it('is bounded by 1 and strictly increasing', () => {
    expect(softSquash(0)).toBe(0);
    expect(softSquash(1)).toBe(0.5);
    expect(softSquash(1000)).toBeLessThan(1);
    expect(softSquash(5)).toBeGreaterThan(softSquash(1));
  });

  it('takes the scale as a parameter, which is what makes it the weakening rule', () => {
    expect(softSquash(1, 10)).toBeCloseTo(1 / 11, 12);
    expect(softSquash(1, 1)).toBe(0.5);
  });
});

describe('renormalize', () => {
  const items = [
    { option: 'a', p: 1 },
    { option: 'b', p: 3 },
  ];

  it('keeps the payload while rescaling the mass, which normalizeToSum cannot', () => {
    const out = renormalize(
      items,
      (d) => d.p,
      (d, p) => ({ ...d, p })
    );
    expect(out).toEqual([
      { option: 'a', p: 0.25 },
      { option: 'b', p: 0.75 },
    ]);
    expect(sumBy(out, (d) => d.p)).toBeCloseTo(1, 12);
  });

  it('falls back to the input when the mass cannot be normalized', () => {
    expect(
      renormalize(
        [{ p: 0 }, { p: 0 }],
        (d) => d.p,
        (d, p) => ({ ...d, p })
      )
    ).toEqual([{ p: 0 }, { p: 0 }]);
    const zero: { p: number }[] = [];
    expect(
      renormalize(
        zero,
        (d) => d.p,
        (d, p) => ({ ...d, p }),
        zero
      )
    ).toBe(zero);
  });

  it('agrees with normalizeToSum on the mass it produces', () => {
    const masses = [1, 3, 6];
    const out = renormalize(
      masses,
      (m) => m,
      (_m, share) => share
    );
    expect(out).toEqual(normalizeToSum(masses, (m) => m));
  });
});
