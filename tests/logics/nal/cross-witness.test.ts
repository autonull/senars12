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

/** Create test premises. */
function makePremises(pairs: Array<{ f: number; c: number }>): Array<{ term: any; truth: TruthValue; stamp: Stamp }> {
  return pairs.map((p, i) => ({
    term: termInterner.constant(`test${i}`),
    truth: { f: p.f, c: p.c },
    stamp: { id: `stamp${i}`, ts: Date.now(), parents: [], derivation: [], evidence: i },
  }));
}

/** Test case for binary operations. */
interface BinaryTestCase {
  op: string;
  t1: TruthValue;
  t2: TruthValue;
}

/** Test case for unary operations. */
interface UnaryTestCase {
  op: string;
  t: TruthValue;
}

/** Binary truth test cases. */
const BINARY_CASES: BinaryTestCase[] = [
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
  { op: 'intersection', t1: { f: 0.8, c: 0.9 }, t2: { f: 0.6, c: 0.9 } },
  { op: 'union', t1: { f: 0.8, c: 0.9 }, t2: { f: 0.6, c: 0.9 } },
  { op: 'detachment', t1: { f: 1.0, c: 0.9 }, t2: { f: 1.0, c: 0.9 } },
];

/** Unary truth test cases. */
const UNARY_CASES: UnaryTestCase[] = [
  { op: 'negation', t: { f: 0.8, c: 0.9 } },
  { op: 'conversion', t: { f: 0.8, c: 0.9 } },
  { op: 'structuralDeduction', t: { f: 0.8, c: 0.9 } },
  { op: 'structuralReduction', t: { f: 0.8, c: 0.9 } },
  { op: 'reinforce', t: { f: 0.8, c: 0.8 } },
  { op: 'contradict', t: { f: 0.8, c: 0.8 } },
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
  const stamp: Stamp = { id: 'test', ts: Date.now(), parents: [], derivation: [], evidence: 0 };

  describe('Binary Operations — Three-Way Agreement', () => {
    for (const { op, t1, t2 } of BINARY_CASES) {
      it(`agrees on ${op}(${t1.f},${t1.c}; ${t2.f},${t2.c})`, () => {
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

        // Interpreter result (via rule application)
        const rule = NAL_RULES_AST.find(r => r.truthFn === op);
        let interpreterResult: TruthValue | null = null;
        if (rule) {
          const premises = [
            { term: termInterner.constant('A'), truth: t1, stamp, role: 'major' },
            { term: termInterner.constant('B'), truth: t2, stamp, role: 'minor' },
          ];
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
          const premises = [
            { term: termInterner.constant('A'), truth: t, stamp, role: 'premise' },
          ];
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
      const rule = NAL_RULES_AST.find(r => r.id === 'deduction')!;
      const premises = [
        { term: termInterner.inheritance(termInterner.constant('bird'), termInterner.constant('animal')), truth: { f: 1.0, c: 0.9 }, stamp, role: 'major' },
        { term: termInterner.inheritance(termInterner.constant('animal'), termInterner.constant('organism')), truth: { f: 1.0, c: 0.9 }, stamp, role: 'minor' },
      ];

      // Interpreter
      const interpResult = interpretRule(rule, premises, stamp);

      // Engine (via StepExecutor would be used in real code)
      // For this test, we verify the interpreter computes the right truth
      const engineTruth = Truth.deduction(premises[0]!.truth, premises[1]!.truth);
      const expectedConclusion = termInterner.inheritance(termInterner.constant('bird'), termInterner.constant('organism'));

      expect(interpResult).not.toBeNull();
      expect(interpResult!.conclusion).toBe(expectedConclusion);
      expect(truthClose(interpResult!.truth, engineTruth)).toBe(true);
    });

    it('revision rule produces same truth', () => {
      const rule = NAL_RULES_AST.find(r => r.id === 'revision')!;
      const term = termInterner.constant('test');
      const premises = [
        { term, truth: { f: 0.8, c: 0.7 }, stamp, role: 'belief1' },
        { term, truth: { f: 0.7, c: 0.8 }, stamp, role: 'belief2' },
      ];

      const interpResult = interpretRule(rule, premises, stamp);
      const engineTruth = Truth.revision(premises[0]!.truth, premises[1]!.truth);

      expect(interpResult).not.toBeNull();
      expect(interpResult!.conclusion).toBe(term);
      expect(truthClose(interpResult!.truth, engineTruth)).toBe(true);
    });
  });

  describe('Batch Rule Application — interpretAllRules', () => {
    it('returns same results as individual rule application', () => {
      const premises = [
        { term: termInterner.inheritance(termInterner.constant('A'), termInterner.constant('B')), truth: { f: 1.0, c: 0.9 }, stamp },
        { term: termInterner.inheritance(termInterner.constant('B'), termInterner.constant('C')), truth: { f: 1.0, c: 0.9 }, stamp },
      ];

      const allResults = interpretAllRules(NAL_RULES_AST, premises, stamp, { limit: 50 });
      const deductionResults = allResults.filter(r => r.ruleId === 'deduction');

      expect(deductionResults.length).toBeGreaterThan(0);
      const dedResult = deductionResults[0]!;
      const engineTruth = Truth.deduction(premises[0]!.truth, premises[1]!.truth);
      expect(truthClose(dedResult.truth, engineTruth)).toBe(true);
    });
  });

  describe('Verifier Table — resolveTruthFn', () => {
    it('resolves engine truth functions correctly', () => {
      const deductionFn = resolveTruthFn('deduction', 'deduction');
      expect(deductionFn).not.toBeNull();

      const result = deductionFn!({ f: 1.0, c: 0.9 }, { f: 1.0, c: 0.9 });
      expect(result).toEqual({ f: 1.0, c: 0.81 });
    });

    it('returns null for unknown functions', () => {
      const fn = resolveTruthFn('unknown', 'nonexistent');
      expect(fn).toBeNull();
    });
  });

  describe('Declared Drift — revision:frequency', () => {
    it('documents the known drift between engine and verifier table', () => {
      // High confidence case where engine switches to confidence-weighted frequency
      const t1 = { f: 0.9, c: 0.99 };
      const t2 = { f: 0.8, c: 0.99 };

      const engineResult = Truth.revision(t1, t2);
      const verifierResult = (() => {
        const [f, c] = BINARY_TRUTH.revision(t1.f, t2.f, t1.c, t2.c);
        return { f, c };
      })();

      // The drift: engine uses confidence-weighted when newC > MAX_CONFIDENCE
      // Verifier always uses weight-based frequency
      // This is the ONLY declared drift
      expect(engineResult.f).toBeCloseTo(verifierResult.f, 2); // May differ slightly
      expect(engineResult.c).toBeCloseTo(verifierResult.c, 2); // May differ slightly

      // But both should be within bounds
      expect(engineResult.c).toBeLessThanOrEqual(Truth.MAX_CONFIDENCE);
      expect(verifierResult.c).toBeLessThanOrEqual(Truth.MAX_CONFIDENCE);
    });
  });

  describe('Rule Completeness', () => {
    it('all rules have truth functions that exist in engine', () => {
      for (const rule of NAL_RULES_AST) {
        const fn = getEngineFn(rule.truthFn);
        expect(fn).toBeDefined();
      }
    });

    it('all rules have truth functions in verifier table (binary or unary)', () => {
      for (const rule of NAL_RULES_AST) {
        const inBinary = rule.truthFn in BINARY_TRUTH;
        const inUnary = rule.truthFn in UNARY_TRUTH;
        expect(inBinary || inUnary).toBe(true);
      }
    });
  });
});