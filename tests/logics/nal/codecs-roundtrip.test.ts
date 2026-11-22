/**
 * Codec Round-Trip Tests — verify all notation codecs encode/decode correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CODECS, testAllCodecs, type Belief } from '@senars/logics/nal/codecs';
import { termInterner } from '@senars/kernel/terms/intern';
import { Stamp } from '@senars/kernel/stamp';
import type { TruthValue } from '@senars/kernel/types';

/** Create test beliefs using the current interner state. */
function createTestBeliefs(): Belief[] {
  const stamp: Stamp = { id: 'test', ts: Date.now(), parents: [], derivation: [], evidence: 0 };

  return [
    // Simple inheritance
    {
      term: termInterner.inheritance(termInterner.constant('bird'), termInterner.constant('animal')),
      truth: { f: 1.0, c: 0.9 },
      stamp,
    },
    // Similarity
    {
      term: termInterner.similarity(termInterner.constant('robin'), termInterner.constant('bird')),
      truth: { f: 0.8, c: 0.9 },
      stamp,
    },
    // Conjunction
    {
      term: termInterner.conjunction(
        termInterner.constant('bird'),
        termInterner.constant('flies')
      ),
      truth: { f: 0.7, c: 0.8 },
      stamp,
    },
    // Negation
    {
      term: termInterner.negation(termInterner.constant('penguin')),
      truth: { f: 0.2, c: 0.9 },
      stamp,
    },
    // Implication
    {
      term: termInterner.implication(
        termInterner.constant('bird'),
        termInterner.constant('flies')
      ),
      truth: { f: 0.6, c: 0.7 },
      stamp,
    },
    // Prediction (temporal)
    {
      term: termInterner.prediction(
        termInterner.constant('rain'),
        termInterner.constant('wet')
      ),
      truth: { f: 0.9, c: 0.8 },
      stamp,
    },
    // Sequential
    {
      term: termInterner.sequential(
        termInterner.constant('eat'),
        termInterner.constant('full')
      ),
      truth: { f: 0.8, c: 0.9 },
      stamp,
    },
    // Product
    {
      term: termInterner.product(
        termInterner.constant('red'),
        termInterner.constant('ball')
      ),
      truth: { f: 0.5, c: 0.6 },
      stamp,
    },
  ];
}

describe('Codec Round-Trip Tests', () => {
  let beliefs: Belief[];

  beforeEach(() => {
    beliefs = createTestBeliefs();
  });

  describe('Narsese Codec', () => {
    const codec = CODECS.narsese;

    it('encodes and decodes simple beliefs', () => {
      for (const belief of beliefs) {
        const encoded = codec.encode(belief);
        const decoded = codec.decode(encoded);

        expect(decoded).not.toBeNull();
        expect(decoded!.term).toBe(belief.term); // Interned terms
        expect(decoded!.truth.f).toBeCloseTo(belief.truth.f, 2);
        expect(decoded!.truth.c).toBeCloseTo(belief.truth.c, 2);
      }
    });

    it('handles batch encoding/decoding', () => {
      const batch = codec.encodeBatch(beliefs);
      const decoded = codec.decodeBatch(batch);

      expect(decoded.length).toBe(beliefs.length);
      for (let i = 0; i < beliefs.length; i++) {
        expect(decoded[i]!.term).toBe(beliefs[i]!.term);
        expect(decoded[i]!.truth.f).toBeCloseTo(beliefs[i]!.truth.f, 2);
        expect(decoded[i]!.truth.c).toBeCloseTo(beliefs[i]!.truth.c, 2);
      }
    });

    it('formats truth values correctly', () => {
      const belief = beliefs[0]!;
      const encoded = codec.encode(belief);
      expect(encoded).toMatch(/^\(.*\) %[\d.]+;[\d.]+%$/);
    });
  });

  describe('JSON Codec', () => {
    const codec = CODECS.json;

    it('encodes and decodes with full stamp preservation', () => {
      for (const belief of beliefs) {
        const encoded = codec.encode(belief);
        const decoded = codec.decode(encoded);

        expect(decoded).not.toBeNull();
        expect(decoded!.term).toBe(belief.term);
        expect(decoded!.truth).toEqual(belief.truth);
        expect(decoded!.stamp.id).toBe(belief.stamp.id);
        expect(decoded!.stamp.evidence).toBe(belief.stamp.evidence);
      }
    });

    it('handles batch encoding/decoding', () => {
      const batch = codec.encodeBatch(beliefs);
      const decoded = codec.decodeBatch(batch);

      expect(decoded.length).toBe(beliefs.length);
    });
  });

  describe('TPTP Codec', () => {
    const codec = CODECS.tptp;

    it('encodes basic formulas', () => {
      for (const belief of beliefs.slice(0, 4)) { // Skip temporal for TPTP
        const encoded = codec.encode(belief);
        expect(encoded).toMatch(/^cnf\(.*axiom.*\)\.$/);
      }
    });

    it('includes truth values in encoding', () => {
      const belief = beliefs[0]!;
      const encoded = codec.encode(belief);
      expect(encoded).toMatch(/\[[\d.]+,\s*[\d.]+\]/);
    });
  });

  describe('SMT-LIB Codec', () => {
    const codec = CODECS.smtlib;

    it('encodes to SMT-LIB format', () => {
      for (const belief of beliefs.slice(0, 4)) {
        const encoded = codec.encode(belief);
        expect(encoded).toMatch(/^\(assert \(and/);
      }
    });

    it('batch encoding produces valid SMT-LIB', () => {
      const batch = codec.encodeBatch(beliefs.slice(0, 3));
      expect(batch).toMatch(/^\(and\n/);
      expect(batch).toMatch(/\)$/);
    });
  });

  describe('DIMACS Codec', () => {
    const codec = CODECS.dimacs;

    it('encodes to DIMACS CNF format', () => {
      const belief = beliefs[0]!;
      const encoded = codec.encode(belief);

      const lines = encoded.split('\n');
      expect(lines[0]).toMatch(/^p cnf \d+ \d+$/);
      expect(lines.some(l => l.endsWith(' 0'))).toBe(true);
    });
  });

  describe('All Codecs — Round-Trip Property', () => {
    it('narsese: all beliefs round-trip correctly', () => {
      const results = testAllCodecs(beliefs);
      expect(results.narsese.failed).toBe(0);
      expect(results.narsese.passed).toBe(beliefs.length);
    });

    it('json: all beliefs round-trip correctly', () => {
      const results = testAllCodecs(beliefs);
      expect(results.json.failed).toBe(0);
      expect(results.json.passed).toBe(beliefs.length);
    });

    it('tptp: all beliefs round-trip correctly', () => {
      const results = testAllCodecs(beliefs);
      expect(results.tptp.failed).toBe(0);
      expect(results.tptp.passed).toBe(beliefs.length);
    });

    it('smtlib: all beliefs round-trip correctly', () => {
      const results = testAllCodecs(beliefs);
      expect(results.smtlib.failed).toBe(0);
      expect(results.smtlib.passed).toBe(beliefs.length);
    });
  });

  describe('Edge Cases', () => {
    it('handles extreme truth values', () => {
      const stamp: Stamp = { id: 'edge', ts: Date.now(), parents: [], derivation: [], evidence: 0 };
      const edgeBeliefs: Belief[] = [
        { term: termInterner.constant('true'), truth: { f: 1.0, c: 0.999 }, stamp },
        { term: termInterner.constant('false'), truth: { f: 0.0, c: 0.999 }, stamp },
        { term: termInterner.constant('neutral'), truth: { f: 0.5, c: 0.0 }, stamp },
      ];

      for (const codec of [CODECS.narsese, CODECS.json]) {
        for (const belief of edgeBeliefs) {
          const encoded = codec.encode(belief);
          const decoded = codec.decode(encoded);
          expect(decoded).not.toBeNull();
          expect(decoded!.truth.f).toBeCloseTo(belief.truth.f, 3);
          expect(decoded!.truth.c).toBeCloseTo(belief.truth.c, 3);
        }
      }
    });

    it('handles variable terms', () => {
      const stamp: Stamp = { id: 'var', ts: Date.now(), parents: [], derivation: [], evidence: 0 };
      const varBelief: Belief = {
        term: termInterner.variable('X'),
        truth: { f: 0.5, c: 0.9 },
        stamp,
      };

      const encoded = CODECS.narsese.encode(varBelief);
      const decoded = CODECS.narsese.decode(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded!.term.op).toBe('var');
    });
  });
});