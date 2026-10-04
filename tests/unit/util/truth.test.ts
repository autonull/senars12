import { describe, expect, it } from 'vitest';

import {
  asBeliefTruth,
  BeliefTruthSchema,
  formatTruth,
  parseNarseseTruth,
  parseTruthLiteral,
  serializeTruth,
  stripTruthSuffix,
  TermTruthSchema,
} from '@senars/util';

const BELIEF = { frequency: 0.8, confidence: 0.9 };
const TERM = { f: 0.8, c: 0.9 };

describe('truth schemas', () => {
  it('admits both truth spellings under their own guard', () => {
    expect(BeliefTruthSchema.parse(BELIEF)).toEqual(BELIEF);
    expect(TermTruthSchema.parse(TERM)).toEqual(TERM);
  });

  it('bounds both to 0..1 — a truth that is a probability, not a weight', () => {
    for (const schema of [BeliefTruthSchema, TermTruthSchema]) {
      expect(schema.safeParse({ frequency: 1.1, confidence: 0.5 }).success).toBe(false);
      expect(schema.safeParse({ frequency: 0.5, confidence: -0.1 }).success).toBe(false);
      expect(schema.safeParse({ f: 1.1, c: 0.5 }).success).toBe(false);
      expect(schema.safeParse({ f: 0.5, c: -0.1 }).success).toBe(false);
    }
  });

  it('refuses a missing component, so a half-truth cannot cross the boundary', () => {
    expect(BeliefTruthSchema.safeParse({ frequency: 0.5 }).success).toBe(false);
    expect(TermTruthSchema.safeParse({ f: 0.5 }).success).toBe(false);
  });
});

describe('asBeliefTruth', () => {
  it('reads either spelling onto the one belief shape', () => {
    expect(asBeliefTruth(TERM)).toEqual(BELIEF);
    expect(asBeliefTruth(BELIEF)).toEqual(BELIEF);
  });

  it('keeps absent truth absent rather than inventing a zero', () => {
    expect(asBeliefTruth(undefined)).toBeUndefined();
  });
});

describe('truth literals', () => {
  it('round-trips through the %f;c% writer', () => {
    expect(serializeTruth(TERM)).toBe('%0.8000;0.9000%');
    expect(parseTruthLiteral('%0.8000;0.9000%')).toEqual(TERM);
  });

  it('tolerates the whitespace a term’s punctuation leaves around a literal', () => {
    expect(parseTruthLiteral('% 0.8; 0.9 %')).toEqual(TERM);
  });

  it('round-trips through the :f:c suffix writer', () => {
    expect(formatTruth(BELIEF)).toBe('(f=0.80, c=0.90)');
    expect(parseNarseseTruth('(cat --> animal) :0.8:0.9')).toEqual(TERM);
  });

  it('strips either suffix whole, leaving a body that parses on its own', () => {
    expect(stripTruthSuffix('(cat --> animal) %0.8; 0.9%')).toEqual({
      text: '(cat --> animal)',
      truth: TERM,
    });
    expect(stripTruthSuffix('(cat --> animal) :0.8:0.9')).toEqual({
      text: '(cat --> animal)',
      truth: TERM,
    });
  });

  it('leaves a suffix-free sentence alone', () => {
    expect(stripTruthSuffix('(cat --> animal)')).toEqual({ text: '(cat --> animal)' });
  });
});