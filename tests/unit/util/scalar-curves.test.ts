import { clampSigned, decayCurve, lerp, saturationRamp, safeRatio } from '@senars/util';
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
