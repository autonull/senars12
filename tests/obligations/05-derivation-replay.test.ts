/**
 * Obligation 5: Derivation Replay — golden replay is byte-identical.
 *
 * This test verifies that the derivation engine produces deterministic,
 * replayable results. The same seed, same inputs, same engine version
 * must produce byte-identical derivation records.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { termInterner, TermFactory } from '@senars/kernel/terms';
import { Truth } from '@senars/kernel';
import { Stamp } from '@senars/kernel';
import { createStepExecutor, StepExecutor } from '@senars/kernel/step';
import { NALRuleEngine } from '@senars/rules';
import {
  DerivationRecorder,
  DerivationRecord,
  DerivationStepRecord,
  verifyDerivation,
  createReferenceInterpreter,
} from '@senars/verification/record';
import { ReferenceInterpreter } from '@senars/verification/interpreter';
import { REFERENCE_VECTORS } from '@senars/verification/vectors';
import type { Term, TruthValue, Premise, RuleId } from '@senars/kernel';

describe('Obligation 5: Derivation Replay', () => {
  let executor: StepExecutor;
  let ruleEngine: NALRuleEngine;
  let interpreter: ReferenceInterpreter;

  beforeAll(() => {
    termInterner.clear();
    executor = createStepExecutor();
    ruleEngine = new NALRuleEngine(executor);
    interpreter = createReferenceInterpreter();
  });

  describe('Deterministic Step Execution', () => {
    it('should produce identical steps for same inputs', () => {
      const factory = TermFactory.getInstance();
      const termA = factory.constant('A');
      const termB = factory.constant('B');
      const termC = factory.constant('C');

      const inhAB = factory.inheritance(termA, termB);
      const inhBC = factory.inheritance(termB, termC);

      const premise1: Premise = {
        term: inhAB,
        truth: { f: 1.0, c: 0.9 },
        stamp: createStamp(0),
      };
      const premise2: Premise = {
        term: inhBC,
        truth: { f: 1.0, c: 0.9 },
        stamp: createStamp(0),
      };

      const step1 = executor.executeRule('deduction', [premise1, premise2]);
      const step2 = executor.executeRule('deduction', [premise1, premise2]);

      expect(step1).not.toBeNull();
      expect(step2).not.toBeNull();
      expect(step1!.conclusion).toBe(step2!.conclusion);
      expect(step1!.truth).toEqual(step2!.truth);
      expect(step1!.ruleId).toBe(step2!.ruleId);
    });

    it('should produce identical results across multiple runs', () => {
      const factory = TermFactory.getInstance();
      const termA = factory.constant('A');
      const termB = factory.constant('B');

      const inhAB = factory.inheritance(termA, termB);

      const premise: Premise = {
        term: inhAB,
        truth: { f: 0.8, c: 0.9 },
        stamp: createStamp(0),
      };

      const results = Array.from({ length: 10 }, () =>
        executor.executeRule('negation', [premise])
      );

      for (const result of results) {
        expect(result).not.toBeNull();
        expect(result!.conclusion).toBe(results[0]!.conclusion);
        expect(result!.truth).toEqual(results[0]!.truth);
      }
    });
  });

  describe('Golden Replay', () => {
    it('should replay derivation deterministically', () => {
      const factory = TermFactory.getInstance();
      const recorder = new DerivationRecorder('test-engine', '1.0');

      // Build a simple derivation: A-->B, B-->C => A-->C
      const termA = factory.constant('A');
      const termB = factory.constant('B');
      const termC = factory.constant('C');

      const inhAB = factory.inheritance(termA, termB);
      const inhBC = factory.inheritance(termB, termC);
      const inhAC = factory.inheritance(termA, termC);

      const stamp0 = createStamp(0);
      const stamp1 = createStamp(1, ['deduction']);

      // Step 1: deduction
      const step1 = recorder.record({
        ruleId: 'deduction',
        ruleCategory: 'deduction',
        premises: [
          { term: inhAB, truth: { f: 1.0, c: 0.9 }, stamp: stamp0 },
          { term: inhBC, truth: { f: 1.0, c: 0.9 }, stamp: stamp0 },
        ],
        conclusion: inhAC,
        truth: { f: 1.0, c: 0.81 },
        stamp: stamp1,
        truthOp: 'deduction',
        depth: 1,
        engine: 'test-engine',
        engineVersion: '1.0',
      });

      // Finalize
      const record = recorder.finalize(inhAC, { f: 0.9, c: 0.8 }, 42);

      // Verify
      const verification = interpreter.verify(record);
      expect(verification.passed).toBe(true);
      expect(verification.summary.failedSteps).toBe(0);
    });

    it('should produce byte-identical records for same seed', () => {
      const factory = TermFactory.getInstance();
      const termA = factory.constant('A');
      const termB = factory.constant('B');
      const termC = factory.constant('C');

      const inhAB = factory.inheritance(termA, termB);
      const inhBC = factory.inheritance(termB, termC);
      const inhAC = factory.inheritance(termA, termC);

      // Create two identical derivations
      const recorder1 = new DerivationRecorder('test-engine', '1.0');
      const recorder2 = new DerivationRecorder('test-engine', '1.0');

      const stamp0 = createStamp(0);
      const stamp1 = createStamp(1, ['deduction']);

      recorder1.record({
        ruleId: 'deduction',
        ruleCategory: 'deduction',
        premises: [
          { term: inhAB, truth: { f: 1.0, c: 0.9 }, stamp: stamp0 },
          { term: inhBC, truth: { f: 1.0, c: 0.9 }, stamp: stamp0 },
        ],
        conclusion: inhAC,
        truth: { f: 1.0, c: 0.81 },
        stamp: stamp1,
        truthOp: 'deduction',
        depth: 1,
        engine: 'test-engine',
        engineVersion: '1.0',
      });

      recorder2.record({
        ruleId: 'deduction',
        ruleCategory: 'deduction',
        premises: [
          { term: inhAB, truth: { f: 1.0, c: 0.9 }, stamp: stamp0 },
          { term: inhBC, truth: { f: 1.0, c: 0.9 }, stamp: stamp0 },
        ],
        conclusion: inhAC,
        truth: { f: 1.0, c: 0.81 },
        stamp: stamp1,
        truthOp: 'deduction',
        depth: 1,
        engine: 'test-engine',
        engineVersion: '1.0',
      });

      const record1 = recorder1.finalize(inhAC, { f: 0.9, c: 0.8 }, 42);
      const record2 = recorder2.finalize(inhAC, { f: 0.9, c: 0.8 }, 42);

      // Serialize and compare
      const json1 = JSON.stringify(record1);
      const json2 = JSON.stringify(record2);
      expect(json1).toBe(json2);
    });
  });

  describe('Reference Vector Verification', () => {
    it('should pass all reference vectors', async () => {
      for (const vector of REFERENCE_VECTORS) {
        const result = executor.executeRule(vector.ruleId, vector.input);
        expect(result).not.toBeNull();

        if (!result) continue;

        // Check truth
        const truthDiff = Math.abs(result.truth.f - vector.expectedTruth.f) +
          Math.abs(result.truth.c - vector.expectedTruth.c);
        const tolerance = vector.tolerance ?? 1e-6;

        expect(truthDiff).toBeLessThanOrEqual(tolerance);

        // Check conclusion (structural equality via interning)
        expect(result.conclusion).toBe(vector.expectedConclusion);
      }
    });
  });

  describe('Cross-Derivation Consistency', () => {
    it('should produce consistent results for same goal', () => {
      const factory = TermFactory.getInstance();
      const goal = factory.inheritance(factory.constant('A'), factory.constant('C'));
      const goalTruth = { f: 0.9, c: 0.8 };

      // Run derivation multiple times
      const records: DerivationRecord[] = [];

      for (let i = 0; i < 5; i++) {
        const recorder = new DerivationRecorder('test-engine', '1.0');
        const termA = factory.constant('A');
        const termB = factory.constant('B');
        const termC = factory.constant('C');

        const inhAB = factory.inheritance(termA, termB);
        const inhBC = factory.inheritance(termB, termC);
        const inhAC = factory.inheritance(termA, termC);

        const stamp0 = createStamp(0);
        const stamp1 = createStamp(1, ['deduction']);

        recorder.record({
          ruleId: 'deduction',
          ruleCategory: 'deduction',
          premises: [
            { term: inhAB, truth: { f: 1.0, c: 0.9 }, stamp: stamp0 },
            { term: inhBC, truth: { f: 1.0, c: 0.9 }, stamp: stamp0 },
          ],
          conclusion: inhAC,
          truth: { f: 1.0, c: 0.81 },
          stamp: stamp1,
          truthOp: 'deduction',
          depth: 1,
          engine: 'test-engine',
          engineVersion: '1.0',
        });

        records.push(recorder.finalize(goal, goalTruth, 42 + i));
      }

      // All records should have same conclusions
      for (let i = 1; i < records.length; i++) {
        expect(records[i].conclusions.length).toBe(records[0].conclusions.length);
        for (let j = 0; j < records[0].conclusions.length; j++) {
          expect(records[i].conclusions[j].truth).toEqual(records[0].conclusions[j].truth);
          expect(records[i].conclusions[j].term).toBe(records[0].conclusions[j].term);
        }
      }
    });
  });

  describe('Verification Laws', () => {
    it('should satisfy truth algebra laws', () => {
      // Negation involution
      const t = { f: 0.8, c: 0.9 };
      const neg = Truth.negation(t);
      const negNeg = Truth.negation(neg);
      expect(Truth.equals(t, negNeg)).toBe(true);

      // Revision commutativity
      const t1 = { f: 0.8, c: 0.9 };
      const t2 = { f: 0.3, c: 0.7 };
      const r1 = Truth.revision(t1, t2);
      const r2 = Truth.revision(t2, t1);
      expect(Truth.equals(r1, r2)).toBe(true);

      // Revision associativity
      const t3 = { f: 0.5, c: 0.5 };
      const r3 = Truth.revision(Truth.revision(t1, t2), t3);
      const r4 = Truth.revision(t1, Truth.revision(t2, t3));
      expect(Truth.equals(r3, r4)).toBe(true);

      // Deduction preserves TRUE
      const ded = Truth.deduction(Truth.TRUE, Truth.TRUE);
      expect(Truth.equals(ded, Truth.TRUE)).toBe(true);

      // Deduction with FALSE
      const dedFalse = Truth.deduction(Truth.FALSE, Truth.TRUE);
      expect(Truth.equals(dedFalse, Truth.FALSE)).toBe(true);
    });
  });

  describe('Replay Verification', () => {
    it('should verify derivation against reference interpreter', () => {
      const factory = TermFactory.getInstance();
      const recorder = new DerivationRecorder('test-engine', '1.0');

      const termA = factory.constant('A');
      const termB = factory.constant('B');
      const termC = factory.constant('C');

      const inhAB = factory.inheritance(termA, termB);
      const inhBC = factory.inheritance(termB, termC);
      const inhAC = factory.inheritance(termA, termC);

      const stamp0 = createStamp(0);
      const stamp1 = createStamp(1, ['deduction']);

      recorder.record({
        ruleId: 'deduction',
        ruleCategory: 'deduction',
        premises: [
          { term: inhAB, truth: { f: 1.0, c: 0.9 }, stamp: stamp0 },
          { term: inhBC, truth: { f: 1.0, c: 0.9 }, stamp: stamp0 },
        ],
        conclusion: inhAC,
        truth: { f: 1.0, c: 0.81 },
        stamp: stamp1,
        truthOp: 'deduction',
        depth: 1,
        engine: 'test-engine',
        engineVersion: '1.0',
      });

      const record = recorder.finalize(inhAC, { f: 0.9, c: 0.8 }, 42);

      // Verify with reference interpreter
      const verification = interpreter.verify(record);
      expect(verification.passed).toBe(true);
      expect(verification.maxDiff).toBeLessThan(1e-6);
    });

    it('should detect tampered derivations', () => {
      const factory = TermFactory.getInstance();
      const recorder = new DerivationRecorder('test-engine', '1.0');

      const termA = factory.constant('A');
      const termB = factory.constant('B');
      const termC = factory.constant('C');

      const inhAB = factory.inheritance(termA, termB);
      const inhBC = factory.inheritance(termB, termC);
      const inhAC = factory.inheritance(termA, termC);

      const stamp0 = createStamp(0);
      const stamp1 = createStamp(1, ['deduction']);

      recorder.record({
        ruleId: 'deduction',
        ruleCategory: 'deduction',
        premises: [
          { term: inhAB, truth: { f: 1.0, c: 0.9 }, stamp: stamp0 },
          { term: inhBC, truth: { f: 1.0, c: 0.9 }, stamp: stamp0 },
        ],
        conclusion: inhAC,
        truth: { f: 1.0, c: 0.81 },
        stamp: stamp1,
        truthOp: 'deduction',
        depth: 1,
        engine: 'test-engine',
        engineVersion: '1.0',
      });

      const record = recorder.finalize(inhAC, { f: 0.9, c: 0.8 }, 42);

      // Tamper with the record
      const tamperedRecord: DerivationRecord = {
        ...record,
        steps: record.steps.map(s => ({
          ...s,
          truth: { f: 0.5, c: 0.5 }, // Wrong truth
        })),
      };

      const verification = interpreter.verify(tamperedRecord);
      expect(verification.passed).toBe(false);
      expect(verification.summary.failedSteps).toBeGreaterThan(0);
    });
  });
});

function createStamp(evidence: number, derivation: string[] = []): Stamp {
  return {
    id: `stamp-${evidence}-${derivation.join('-')}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    parents: [],
    derivation,
    evidence,
  };
}