import { describe, expect, it } from 'vitest';
import {
  AttentionField,
  classify,
  decayWeight,
  focus,
  RECLAIM_THRESHOLD,
  tierCeiling,
  tierFor,
  tierRank,
} from '../../src/client/framework/index.js';

describe('attention classifies and ranks', () => {
  it('classifies by ring distance', () => {
    expect(classify(0)).toBe('focus');
    expect(classify(-1)).toBe('focus');
    expect(classify(1)).toBe('ring');
    expect(classify(2)).toBe('ambient');
    expect(classify(9)).toBe('ambient');
  });

  it('orders the fidelity ladder', () => {
    expect(tierRank('reclaimed')).toBe(0);
    expect(tierRank('glyph')).toBe(1);
    expect(tierRank('full')).toBe(4);
  });

  it('spends weight up to a class ceiling', () => {
    expect(tierCeiling('focus')).toBe('full');
    expect(tierCeiling('ring')).toBe('label');
    expect(tierCeiling('ambient')).toBe('glyph');
    expect(tierFor('focus', 1)).toBe('full');
    expect(tierFor('ring', 1)).toBe('label');
    expect(tierFor('ambient', 1)).toBe('glyph');
    expect(tierFor('focus', 0)).toBe('reclaimed');
  });

  it('is monotonic in weight', () => {
    expect(tierFor('focus', 0.25)).toBe('glyph');
    expect(tierFor('focus', 0.5)).toBe('label');
    expect(tierFor('focus', 0.75)).toBe('card');
    expect(tierFor('ring', 0.5)).toBe('glyph');
  });
});

describe('attention decays', () => {
  it('halves over one half-life and clamps the future', () => {
    expect(decayWeight(0.8, 0, 1000)).toBeCloseTo(0.8);
    expect(decayWeight(0.8, 1000, 1000)).toBeCloseTo(0.4);
    expect(decayWeight(0.8, -50, 1000)).toBeCloseTo(0.8);
    expect(decayWeight(0.8, 1000, 0)).toBe(0);
  });

  it('lifts weight on attention but never lowers it', () => {
    const field = new AttentionField(64, 1000);
    const cat = focus.concept('cat');
    field.attend(cat, 'focus', 0.6, 0);
    field.attend(cat, 'focus', 0.2, 0);
    expect(field.weightOf(cat, 0)).toBeCloseTo(0.6);
    expect(field.weightOf(cat, 1000)).toBeCloseTo(0.3);
  });

  it('reclaims a focus once its weight has decayed away', () => {
    const field = new AttentionField(64, 1000);
    const cat = focus.concept('cat');
    field.attend(cat, 'focus', 1, 0);
    expect(field.tierOf(cat, 0)).toBe('full');
    expect(field.tierOf(cat, 100_000)).toBe('reclaimed');
    expect(field.allocate(100_000)).toHaveLength(0);
    expect(field.weightOf(cat, 100_000)).toBe(0);
  });
});

describe('the attention field allocates a budget', () => {
  it('spends richest-first and reclaims the overflow', () => {
    const field = new AttentionField(8, 1_000_000);
    const a = focus.concept('a');
    const b = focus.concept('b');
    field.attend(a, 'focus', 1, 0);
    field.attend(b, 'focus', 0.9, 0);
    const [first, second] = field.allocate(0);
    expect(first?.focus).toEqual(a);
    expect(first?.tier).toBe('full');
    expect(second?.focus).toEqual(b);
    expect(second?.tier).toBe('reclaimed');
  });

  it('never exceeds a class ceiling, however large the budget', () => {
    const field = new AttentionField(10_000, 1_000_000);
    const ring = focus.concept('ring');
    const ambient = focus.concept('ambient');
    field.attend(ring, 'ring', 1, 0);
    field.attend(ambient, 'ambient', 1, 0);
    const tiers = new Map(
      field.allocate(0).map((a) => [a.focus.kind === 'concept' ? a.focus.term : '', a.tier])
    );
    expect(tiers.get('ring')).toBe('label');
    expect(tiers.get('ambient')).toBe('glyph');
  });

  it('releases foci explicitly', () => {
    const field = new AttentionField();
    const cat = focus.concept('cat');
    field.attend(cat, 'focus', 1, 0);
    field.release(cat);
    expect(field.tierOf(cat, 0)).toBe('reclaimed');
  });

  it('reclaims below the threshold on allocation', () => {
    expect(RECLAIM_THRESHOLD).toBeGreaterThan(0);
    const field = new AttentionField(64, 1000);
    const cat = focus.concept('cat');
    field.attend(cat, 'focus', 0.1, 0);
    expect(field.allocate(2000)).toHaveLength(0);
  });
});
