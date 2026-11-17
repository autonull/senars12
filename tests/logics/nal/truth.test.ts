/**
 * NAL Truth Tests — test the truth algebra operations.
 */

import { describe, it, expect } from 'vitest';
import { Truth } from '../../src/kernel/truth.js';

describe('Truth Algebra', () => {
  describe('Constants', () => {
    it('should have correct TRUE value', () => {
      expect(Truth.TRUE.f).toBe(1.0);
      expect(Truth.TRUE.c).toBe(0.9);
    });

    it('should have correct FALSE value', () => {
      expect(Truth.FALSE.f).toBe(0.0);
      expect(Truth.FALSE.c).toBe(0.9);
    });

    it('should have correct NEUTRAL value', () => {
      expect(Truth.NEUTRAL.f).toBe(0.5);
      expect(Truth.NEUTRAL.c).toBe(0.9);
    });
  });

  describe('Normalization', () => {
    it('should clamp frequency to [0,1]', () => {
      expect(Truth.normalize(-0.5, 0.5).f).toBe(0);
      expect(Truth.normalize(1.5, 0.5).f).toBe(1);
    });

    it('should clamp confidence to [0, MAX_CONFIDENCE]', () => {
      expect(Truth.normalize(0.5, -0.5).c).toBe(0);
      expect(Truth.normalize(0.5, 1.5).c).toBe(Truth.MAX_CONFIDENCE);
    });

    it('should use defaults for NaN', () => {
      expect(Truth.normalize(NaN, NaN)).toEqual(Truth.NEUTRAL);
    });
  });

  describe('Unary Operations', () => {
    it('should negate correctly', () => {
      const t = { f: 0.8, c: 0.9 };
      const neg = Truth.negation(t);
      expect(neg.f).toBe(0.2);
      expect(neg.c).toBe(0.9);
    });

    it('should convert correctly', () => {
      const t = { f: 0.8, c: 0.9 };
      const conv = Truth.conversion(t);
      expect(conv.f).toBe(0.8);
      expect(conv.c).toBe(0.72);
    });

    it('should compute attention', () => {
      expect(Truth.attention(Truth.TRUE)).toBe(0.9);
      expect(Truth.attention(Truth.FALSE)).toBe(0.0);
      expect(Truth.attention(Truth.NEUTRAL)).toBe(0.45);
    });

    it('should compute expectation', () => {
      expect(Truth.expectation(Truth.TRUE)).toBe(0.95);
      expect(Truth.expectation(Truth.FALSE)).toBe(0.05);
      expect(Truth.expectation(Truth.NEUTRAL)).toBe(0.5);
    });

    it('should damp confidence', () => {
      const t = { f: 0.8, c: 0.9 };
      const damped = Truth.damp(t, 0.5);
      expect(damped.f).toBe(0.8);
      expect(damped.c).toBe(0.45);
    });

    it('should reinforce', () => {
      const t = { f: 0.8, c: 0.8 };
      const reinforced = Truth.reinforce(t);
      expect(reinforced.f).toBeCloseTo(0.88);
      expect(reinforced.c).toBeCloseTo(0.9);
    });

    it('should contradict', () => {
      const t = { f: 0.8, c: 0.8 };
      const contradicted = Truth.contradict(t);
      expect(contradicted.f).toBeCloseTo(0.72);
      expect(contradicted.c).toBeCloseTo(0.9);
    });
  });

  describe('Binary Operations', () => {
    it('should compute deduction', () => {
      const r = Truth.deduction(Truth.TRUE, Truth.TRUE);
      expect(r.f).toBe(1.0);
      expect(r.c).toBe(0.81);
    });

    it('should compute weak deduction', () => {
      const r = Truth.deductionWeak(Truth.TRUE, Truth.TRUE);
      expect(r).not.toBeNull();
      expect(r!.c).toBeLessThan(0.81);
    });

    it('should compute induction', () => {
      const r = Truth.induction({ f: 1.0, c: 0.9 }, { f: 1.0, c: 0.9 });
      expect(r.f).toBe(1.0);
      expect(r.c).toBeLessThan(0.9);
    });

    it('should compute abduction', () => {
      const r = Truth.abduction({ f: 1.0, c: 0.9 }, { f: 1.0, c: 0.9 });
      expect(r.f).toBe(1.0);
      expect(r.c).toBeLessThan(0.9);
    });

    it('should compute revision', () => {
      const t1 = { f: 0.8, c: 0.7 };
      const t2 = { f: 0.7, c: 0.8 };
      const r = Truth.revision(t1, t2);
      expect(r.f).toBeCloseTo(0.75);
      expect(r.c).toBeGreaterThan(0.7);
      expect(r.c).toBeLessThanOrEqual(Truth.MAX_CONFIDENCE);
    });

    it('should compute analogy', () => {
      const r = Truth.analogy(Truth.TRUE, Truth.TRUE);
      expect(r.f).toBe(1.0);
      expect(r.c).toBe(0.81);
    });

    it('should compute resemblance', () => {
      const r = Truth.resemblance({ f: 0.8, c: 0.9 }, { f: 0.6, c: 0.9 });
      expect(r.f).toBe(0.7);
      expect(r.c).toBe(0.81);
    });

    it('should compute intersection', () => {
      const r = Truth.intersection({ f: 0.8, c: 0.9 }, { f: 0.6, c: 0.9 });
      expect(r.f).toBe(0.48);
      expect(r.c).toBe(0.81);
    });

    it('should compute union', () => {
      const r = Truth.union({ f: 0.8, c: 0.9 }, { f: 0.6, c: 0.9 });
      expect(r.f).toBe(0.92);
      expect(r.c).toBe(0.81);
    });

    it('should compute choice', () => {
      const t1 = { f: 0.8, c: 0.9 };
      const t2 = { f: 0.3, c: 0.9 };
      expect(Truth.choice(t1, t2)).toEqual(t1);
      expect(Truth.choice(t2, t1)).toEqual(t1);
    });
  });

  describe('Chaining Operations', () => {
    it('should chain deduction', () => {
      const r = Truth.deductionChain(Truth.TRUE, Truth.TRUE, 3);
      expect(r.f).toBe(1.0);
      expect(r.c).toBeCloseTo(0.9 * 0.9 * 0.9);
    });

    it('should chain induction with revision', () => {
      const r = Truth.inductionChain({ f: 1.0, c: 0.9 }, { f: 1.0, c: 0.9 }, 3, 'dependent');
      expect(r.f).toBe(1.0);
    });

    it('should chain conversion', () => {
      const r = Truth.conversionChain({ f: 0.8, c: 0.9 }, 2);
      expect(r.f).toBe(0.8);
    });
  });

  describe('Comparison', () => {
    it('should compare by expectation', () => {
      expect(Truth.compare(Truth.TRUE, Truth.FALSE)).toBe(1);
      expect(Truth.compare(Truth.FALSE, Truth.TRUE)).toBe(-1);
      expect(Truth.compare(Truth.NEUTRAL, Truth.NEUTRAL)).toBe(0);
    });

    it('should check equality with epsilon', () => {
      expect(Truth.equals(Truth.TRUE, Truth.TRUE)).toBe(true);
      expect(Truth.equals({ f: 0.5, c: 0.9 }, { f: 0.5001, c: 0.9 })).toBe(true);
      expect(Truth.equals({ f: 0.5, c: 0.9 }, { f: 0.51, c: 0.9 })).toBe(false);
    });

    it('should check isStronger', () => {
      expect(Truth.isStronger(Truth.TRUE, Truth.FALSE)).toBe(true);
      expect(Truth.isStronger(Truth.NEUTRAL, Truth.TRUE)).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize', () => {
      const t = { f: 0.8, c: 0.9 };
      const s = Truth.serialize(t);
      expect(s).toBe('%0.80;0.90%');
      const parsed = Truth.deserialize(s);
      expect(parsed).toEqual(t);
    });

    it('should format with custom digits', () => {
      const t = { f: 0.1234, c: 0.5678 };
      expect(Truth.format(t, 4)).toBe('%0.1234;0.5678%');
    });
  });

  describe('Boundary Conditions', () => {
    it('should not exceed MAX_CONFIDENCE', () => {
      const t1 = { f: 0.9, c: 0.99 };
      const t2 = { f: 0.8, c: 0.99 };
      const r = Truth.revision(t1, t2);
      expect(r.c).toBeLessThanOrEqual(Truth.MAX_CONFIDENCE);
    });

    it('should handle zero confidence', () => {
      const t = { f: 0.5, c: 0 };
      const r = Truth.revision(t, t);
      expect(r.c).toBe(0);
    });

    it('should handle extreme frequencies', () => {
      const t1 = { f: 1.0, c: 0.5 };
      const t2 = { f: 0.0, c: 0.5 };
      const r = Truth.deduction(t1, t2);
      expect(r.f).toBe(0.0);
    });
  });

  describe('Truth Laws', () => {
    it('should satisfy negation involution', () => {
      const t = { f: 0.8, c: 0.9 };
      const neg = Truth.negation(t);
      const negNeg = Truth.negation(neg);
      expect(Truth.equals(t, negNeg)).toBe(true);
    });

    it('should satisfy revision commutativity', () => {
      const t1 = { f: 0.8, c: 0.9 };
      const t2 = { f: 0.3, c: 0.7 };
      const r1 = Truth.revision(t1, t2);
      const r2 = Truth.revision(t2, t1);
      expect(Truth.equals(r1, r2)).toBe(true);
    });

    it('should satisfy revision associativity', () => {
      const t1 = { f: 0.8, c: 0.9 };
      const t2 = { f: 0.3, c: 0.7 };
      const t3 = { f: 0.5, c: 0.5 };
      const r1 = Truth.revision(Truth.revision(t1, t2), t3);
      const r2 = Truth.revision(t1, Truth.revision(t2, t3));
      expect(Truth.equals(r1, r2)).toBe(true);
    });

    it('should preserve TRUE in deduction', () => {
      const r = Truth.deduction(Truth.TRUE, Truth.TRUE);
      expect(Truth.equals(r, Truth.TRUE)).toBe(true);
    });

    it('should annihilate with FALSE in deduction', () => {
      const r = Truth.deduction(Truth.FALSE, Truth.TRUE);
      expect(Truth.equals(r, Truth.FALSE)).toBe(true);
    });
  });
});