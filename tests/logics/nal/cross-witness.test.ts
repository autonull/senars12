/**
 * Cross-Witness Agreement Tests — verify engine, interpreter, and verifier table agree.
 *
 * Three independent witnesses:
 * 1. Engine (compiled, optimized) - src/kernel/truth.ts
 * 2. Interpreter (reference, formula-AST) - src/logics/nal/interpreter.ts
 * 3. Verifier Table (transcribed, independent) - src/rules/verifier-truth-table.ts
 */

import { describe, it, expect } from 'vitest';
import { Truth } from '@senars/kernel';
import { NAL_RULES_AST } from '@senars/logics/nal/rules-ast';
import { interpretRule, interpretAllRules, createNALInterpreter } from '@senars/logics/nal/interpreter';
import { BINARY_TRUTH, UNARY_TRUTH, resolveTruthFn } from '@senars/rules/verifier-truth-table';
import { termInterner } from '@senars/kernel/terms/intern';
import { Stamp } from '@senars/kernel/stamp';
import type { TruthValue } from '@senars/kernel/types';
import { TermOp } from '@senars/kernel/terms/intern';

/** Create a test stamp. */
function makeStamp(id: string): Stamp {
  return { id, ts: Date.now(), parents: [], derivation: [], evidence: 0 };
}

/** Create test premises with proper term structure for each truthFn. */
function makeBinaryPremises(op: string, t1: TruthValue, t2: TruthValue, stamp: Stamp): Array<{ term: any; truth: TruthValue; stamp: Stamp; role: string }> {
  const S1 = termInterner.constant('S1');
  const S2 = termInterner.constant('S2');
  const P1 = termInterner.constant('P1');
  const P2 = termInterner.constant('P2');
  const P = termInterner.constant('P');

  switch (op) {
    case 'deduction':
      // S1-->P1, S2-->P2 where P1==S2 => S1-->P2
      // Use: S1-->P, P-->P2
      return [
        { term: termInterner.inheritance(S1, P), truth: t1, stamp, role: 'major' },
        { term: termInterner.inheritance(P, P2), truth: t2, stamp, role: 'minor' },
      ];
    case 'induction':
      // S1-->P, S2-->P => S1<->S2 (similarity)
      return [
        { term: termInterner.inheritance(S1, P), truth: t1, stamp, role: 'major' },
        { term: termInterner.inheritance(S2, P), truth: t2, stamp, role: 'minor' },
      ];
    case 'abduction':
      // S1-->P1, S2-->P2 where S1==S2 => P1<->P2
      // Use: S-->P1, S-->P2
      return [
        { term: termInterner.inheritance(S1, P1), truth: t1, stamp, role: 'major' },
        { term: termInterner.inheritance(S1, P2), truth: t2, stamp, role: 'minor' },
      ];
    case 'revision': {
      // S1-->P, S2-->P (same subject and predicate) => merged
      // Use same term for both premises
      const term = termInterner.inheritance(S1, P);
      return [
        { term, truth: t1, stamp, role: 'major' },
        { term, truth: t2, stamp, role: 'minor' },
      ];
    }
    case 'analogy':
      // S1-->P1, S2-->P2 => (S1*S2)<->(P1*P2)
      return [
        { term: termInterner.inheritance(S1, P1), truth: t1, stamp, role: 'major' },
        { term: termInterner.inheritance(S2, P2), truth: t2, stamp, role: 'minor' },
      ];
    case 'resemblance':
      // S1-->P, S2-->P => S1<->S2
      return [
        { term: termInterner.inheritance(S1, P), truth: t1, stamp, role: 'major' },
        { term: termInterner.inheritance(S2, P), truth: t2, stamp, role: 'minor' },
      ];
    default:
      // Fallback: use inheritance terms
      return [
        { term: termInterner.inheritance(S1, P), truth: t1, stamp, role: 'major' },
        { term: termInterner.inheritance(S2, P), truth: t2, stamp, role: 'minor' },
      ];
  }
}

function makeUnaryPremises(op: string, t: TruthValue, stamp: Stamp): Array<{ term: any; truth: TruthValue; stamp: Stamp; role: string }> {
  const S = termInterner.constant('S');
  const P = termInterner.constant('P');

  switch (op) {
    case 'conversion':
      // Requires inheritance term
      return [{ term: termInterner.inheritance(S, P), truth: t, stamp, role: 'premise' }];
    case 'negation':
    case 'structuralDeduction':
    default:
      // These work with any term type
      return [{ term: termInterner.inheritance(S, P), truth: t, stamp, role: 'premise' }];
  }
}

/** Binary truth test cases — only for operations that have rules in NAL_RULES_AST. */
const BINARY_CASES: Array<{ op: string; t1: TruthValue; t2: TruthValue }> = [
  { op: 'deduction', t1: { f: 1.0, c: 0.9 }, t2: { f: 1.0, c: 0.9 } },
  { op: 'deduction', t1: { f: 0.0, c: 0.9 }, t2: { f: 1.0, c: 0.9 } },
  { op: 'deduction', t1: { f: 0.8, c: 0.9 }, t2: { f: 0.6, c: 0.9 } },
  { op: 'induction', t1: { f: 1.0, c: 0.9 }, t2: { f: 1.0, c: 0.9 } },
  { op: 'induction', t1: { f: 0.5, c: 0.9 }, t2: { f: 0.5, c: 0.9 } },
  { op: 'abduction', t1: { f: 1.0, c: 0.9 }, t2: { f: 1.0, c: 0.9 } },
  { op: 'revision', t1: { f: 0.8, c: 0.7 }, t2: { f: 0.7, c: 0.8 } },
  { op: 'revision', t1: { f: 1.0, c: 0.9 }, t2: { f: 0.0, c: 0.9 } },
  { op: 'analogy', t1: { f: 1.0, c: 0.9 }, t2: { f: 1.0, c: 0.9 } },
  { op: 'analogy', t1: { f: 0.8, c: 0.9 }, t2: { f: 0.6, c: 0.9 } },
  { op: 'resemblance', t1: { f: 0.8, c: 0.9 }, t2: { f: 0.6, c: 0.9 } },
];

/** Unary truth test cases — only for operations that have rules in NAL_RULES_AST with matching conditions. */
const UNARY_CASES: Array<{ op: string; t: TruthValue }> = [
  { op: 'negation', t: { f: 0.8, c: 0.9 } },
  { op: 'conversion', t: { f: 0.8, c: 0.9 } },
];

/** Compare two truth values within epsilon. */
function truthClose(t1: TruthValue | null, t2: TruthValue | null, eps = 1e-9): boolean {
  if (!t1 && !t2) return true;
  if (!t1 || !t2) return false;
  return Math.abs(t1.f - t2.f) < eps && Math.abs(t1.c - t2.c) < eps;
}

/** Get engine truth function. */
function getEngineFn(name: string): (t1: TruthValue, t2?: TruthValue) => TruthValue | null {
  const fn = Truth[name as keyof typeof Truth];
  if (typeof fn !== 'function') throw new Error(`Unknown engine truth function: ${name}`);
  return fn as (t1: TruthValue, t2?: TruthValue) => TruthValue | null;
}

describe('Cross-Witness Agreement — Engine vs Interpreter vs Verifier Table', () => {
  const interpreter = createNALInterpreter(NAL_RULES_AST);

  describe('Binary Operations — Three-Way Agreement', () => {
    for (const { op, t1, t2 } of BINARY_CASES) {
      it(`agrees on ${op}(${t1.f},${t1.c}; ${t2.f},${t2.c})`, () => {
        const stamp = makeStamp(`test-${op}-${t1.f}-${t2.f}`);

        // Engine result
        const engineFn = getEngineFn(op);
        const engineResult = engineFn(t1, t2);

        // Verifier table result
        const verifierFn = BINARY_TRUTH[op];
        let verifierResult: TruthValue | null = null;
        if (verifierFn) {
          const [f, c] = verifierFn(t1.f, t2.f, t1.c, t2.c);
          verifierResult = { f, c };
        }

        // Interpreter result (via rule application with proper premises)
        const rule = NAL_RULES_AST.find(r => r.truthFn === op);
        let interpreterResult: TruthValue | null = null;
        if (rule) {
          const premises = makeBinaryPremises(op, t1, t2, stamp);
          const result = interpretRule(rule, premises, stamp);
          interpreterResult = result?.truth ?? null;
        }

        // All three should agree (within epsilon)
        expect(truthClose(engineResult, verifierResult)).toBe(true);
        expect(truthClose(engineResult, interpreterResult)).toBe(true);
        expect(truthClose(verifierResult, interpreterResult)).toBe(true);

        // Log for debugging if they differ
        if (!truthClose(engineResult, verifierResult) || !truthClose(engineResult, interpreterResult)) {
          console.log(`${op}: engine=${JSON.stringify(engineResult)}, verifier=${JSON.stringify(verifierResult)}, interpreter=${JSON.stringify(interpreterResult)}`);
        }
      });
    }
  });

  describe('Unary Operations — Three-Way Agreement', () => {
    for (const { op, t } of UNARY_CASES) {
      it(`agrees on ${op}(${t.f},${t.c})`, () => {
        const stamp = makeStamp(`test-${op}-${t.f}`);

        // Engine result
        const engineFn = getEngineFn(op);
        const engineResult = engineFn(t);

        // Verifier table result
        const verifierFn = UNARY_TRUTH[op];
        let verifierResult: TruthValue | null = null;
        if (verifierFn) {
          const [f, c] = verifierFn(t.f, t.c);
          verifierResult = { f, c };
        }

        // Interpreter result
        const rule = NAL_RULES_AST.find(r => r.truthFn === op);
        let interpreterResult: TruthValue | null = null;
        if (rule) {
          const premises = makeUnaryPremises(op, t, stamp);
          const result = interpretRule(rule, premises, stamp);
          interpreterResult = result?.truth ?? null;
        }

        // All three should agree
        expect(truthClose(engineResult, verifierResult)).toBe(true);
        expect(truthClose(engineResult, interpreterResult)).toBe(true);
        expect(truthClose(verifierResult, interpreterResult)).toBe(true);
      });
    }
  });

  describe('Rule Application — Engine vs Interpreter', () => {
    it('deduction rule produces same conclusion and truth', () => {
      const stamp = makeStamp('deduction-rule');
      const t1 = { f: 1.0, c: 0.9 };
      const t2 = { f: 1.0, c: 0.9 };

      const S1 = termInterner.constant('S1');
      const P = termInterner.constant('P');
      const P2 = termInterner.constant('P2');

      const premises = [
        { term: termInterner.inheritance(S1, P), truth: t1, stamp, role: 'major' },
        { term: termInterner.inheritance(P, P2), truth: t2, stamp, role: 'minor' },
      ];

      const rule = NAL_RULES_AST.find(r => r.id === 'deduction');
      expect(rule).toBeDefined();

      const engineResult = Truth.deduction(t1, t2);
      const result = interpretRule(rule!, premises, stamp);

      expect(result).not.toBeNull();
      expect(truthClose(engineResult, result!.truth)).toBe(true);
      // Conclusion should be S1 --> P2
      expect(result!.conclusion.op).toBe(TermOp.INHERITANCE);
      expect(result!.conclusion.args[0]).toBe(S1);
      expect(result!.conclusion.args[1]).toBe(P2);
    });

    it('revision rule produces same truth', () => {
      const stamp = makeStamp('revision-rule');
      const t1 = { f: 0.8, c: 0.7 };
      const t2 = { f: 0.7, c: 0.8 };

      const S1 = termInterner.constant('S1');
      const P = termInterner.constant('P');
      const term = termInterner.inheritance(S1, P);

      const premises = [
        { term, truth: t1, stamp, role: 'major' },
        { term, truth: t2, stamp, role: 'minor' },
      ];

      const rule = NAL_RULES_AST.find(r => r.id === 'revision');
      expect(rule).toBeDefined();

      const engineResult = Truth.revision(t1, t2);
      const result = interpretRule(rule!, premises, stamp);

      expect(result).not.toBeNull();
      expect(truthClose(engineResult, result!.truth)).toBe(true);
    });

    it('interpretAllRules returns same results as individual rule application', () => {
      const stamp = makeStamp('batch-rule');
      const t1 = { f: 1.0, c: 0.9 };
      const t2 = { f: 1.0, c: 0.9 };

      const S1 = termInterner.constant('S1');
      const P = termInterner.constant('P');
      const P2 = termInterner.constant('P2');

      const premises = [
        { term: termInterner.inheritance(S1, P), truth: t1, stamp, role: 'major' },
        { term: termInterner.inheritance(P, P2), truth: t2, stamp, role: 'minor' },
      ];

      const results = interpretAllRules(NAL_RULES_AST, premises, stamp);

      const deductionRule = NAL_RULES_AST.find(r => r.id === 'deduction');
      const singleResult = interpretRule(deductionRule!, premises, stamp);

      expect(results.length).toBeGreaterThan(0);
      const deductionResult = results.find(r => r.conclusion === singleResult?.conclusion);
      expect(deductionResult).toBeDefined();
      expect(truthClose(deductionResult!.truth, singleResult!.truth)).toBe(true);
    });
  });

  describe('Verifier Table — resolveTruthFn', () => {
    it('resolves engine truth functions correctly', () => {
      const fn = resolveTruthFn('test-rule', 'deduction');
      expect(fn).not.toBeNull();

      const result = fn!({ f: 1.0, c: 0.9 }, { f: 1.0, c: 0.9 });
      expect(result).toEqual({ f: 1.0, c: 0.81 });
    });

    it('returns null for unknown functions', () => {
      const fn = resolveTruthFn('test-rule', 'unknown_function');
      expect(fn).toBeNull();
    });
  });

  describe('Verifier Table — Declared Drift', () => {
    it('documents the known drift between engine and verifier table for revision:frequency', () => {
      // The verifier uses weight-based frequency even when confidence exceeds MAX_CONFIDENCE
      // The engine switches to confidence-weighted frequency in that case
      // Use different confidences to trigger different frequency calculations
      const t1 = { f: 1.0, c: 0.999 };
      const t2 = { f: 0.0, c: 0.99 };

      const engineResult = Truth.revision(t1, t2);
      const [vf, vc] = BINARY_TRUTH.revision(t1.f, t2.f, t1.c, t2.c);
      const verifierResult = { f: vf, c: vc };

      // They differ in frequency calculation when confidence saturates
      expect(engineResult.f).not.toBe(verifierResult.f);
      // But confidence should be the same (clamped to MAX_CONFIDENCE)
      expect(engineResult.c).toBe(verifierResult.c);
    });
  });

  describe('Rule Completeness', () => {
    it('all rules have truth functions that exist in engine', () => {
      for (const rule of NAL_RULES_AST) {
        const fn = Truth[rule.truthFn as keyof typeof Truth];
        expect(typeof fn).toBe('function');
      }
    });

    it('all rules have truth functions in verifier table (binary or unary)', () => {
      for (const rule of NAL_RULES_AST) {
        const hasBinary = rule.truthFn in BINARY_TRUTH;
        const hasUnary = rule.truthFn in UNARY_TRUTH;
        expect(hasBinary || hasUnary).toBe(true);
      }
    });
  });
});