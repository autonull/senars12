/**
 * Verification Interpreter — re-executes derivations for verification.
 *
 * The interpreter takes a derivation record and re-computes every step
 * using the reference truth algebra, ensuring deterministic verification
 * independent of the original engine.
 */

import { Term } from '../kernel/terms/intern';
import { TruthValue } from '../kernel/truth';
import { Truth } from '../kernel/truth';
import { Stamp } from '../kernel/stamp';
import type { RuleId, RuleCategory, Premise, StepResult } from '../kernel/step';
import {
  DerivationRecord,
  DerivationStepRecord,
  DerivationVerificationResult,
  verifyDerivation,
} from './record';

/** Reference interpreter for NAL truth operations. */
export class ReferenceInterpreter {
  /** Interpret a rule application and compute truth. */
  interpret(
    ruleId: RuleId,
    premises: Premise[],
    truthOp: string
  ): TruthValue | null {
    switch (truthOp) {
      // Unary operations
      case 'negation':
        return premises.length === 1 ? Truth.negation(premises[0]!.truth) : null;
      case 'conversion':
        return premises.length === 1 ? Truth.conversion(premises[0]!.truth) : null;
      case 'structuralDeduction':
        return premises.length === 1 ? Truth.structuralDeduction(premises[0]!.truth) : null;
      case 'structuralReduction':
        return premises.length === 1 ? Truth.structuralReduction(premises[0]!.truth) : null;

      // Binary operations
      case 'deduction':
        return premises.length >= 2 ? Truth.deduction(premises[0]!.truth, premises[1]!.truth) : null;
      case 'deductionWeak':
        return premises.length >= 2 ? Truth.deductionWeak(premises[0]!.truth, premises[1]!.truth) : null;
      case 'induction':
        return premises.length >= 2 ? Truth.induction(premises[0]!.truth, premises[1]!.truth) : null;
      case 'abduction':
        return premises.length >= 2 ? Truth.abduction(premises[0]!.truth, premises[1]!.truth) : null;
      case 'detachment':
        return premises.length >= 2 ? Truth.detachment(premises[0]!.truth, premises[1]!.truth) : null;
      case 'revision':
        return premises.length >= 2 ? Truth.revision(premises[0]!.truth, premises[1]!.truth) : null;
      case 'revisionWeak':
        return premises.length >= 2 ? Truth.revisionWeak(premises[0]!.truth, premises[1]!.truth) : null;
      case 'analogy':
        return premises.length >= 2 ? Truth.analogy(premises[0]!.truth, premises[1]!.truth) : null;
      case 'resemblance':
        return premises.length >= 2 ? Truth.resemblance(premises[0]!.truth, premises[1]!.truth) : null;
      case 'intersection':
        return premises.length >= 2 ? Truth.intersection(premises[0]!.truth, premises[1]!.truth) : null;
      case 'union':
        return premises.length >= 2 ? Truth.union(premises[0]!.truth, premises[1]!.truth) : null;

      // N-ary operations (chain binary)
      case 'conjunction':
        return this.chainBinary(premises, Truth.intersection);
      case 'disjunction':
        return this.chainBinary(premises, Truth.union);

      default:
        return null;
    }
  }

  /** Chain a binary operation over multiple premises. */
  private chainBinary(
    premises: Premise[],
    op: (t1: TruthValue, t2: TruthValue) => TruthValue
  ): TruthValue | null {
    if (premises.length === 0) return null;
    let result = premises[0]!.truth;
    for (let i = 1; i < premises.length; i++) {
      result = op(result, premises[i]!.truth);
    }
    return result;
  }

  /** Verify a derivation record. */
  verify(record: DerivationRecord): DerivationVerificationResult {
    return verifyDerivation(record, (premises) => {
      // Find the step that matches these premises
      const step = record.steps.find(s =>
        s.premiseIds.length === premises.length &&
        s.premiseIds.every((id, i) => premises[i]?.stamp.id === id)
      );
      if (!step) return null;
      return this.interpret(step.ruleId, premises, step.truthOp);
    });
  }
}

/** Create a reference interpreter. */
export function createReferenceInterpreter(): ReferenceInterpreter {
  return new ReferenceInterpreter();
}

/** Cross-engine verification: compare results from multiple engines. */
export interface CrossEngineResult {
  engine: string;
  record: DerivationRecord;
  verification: DerivationVerificationResult;
}

export interface CrossEngineVerification {
  goal: Term;
  goalTruth: TruthValue;
  results: CrossEngineResult[];
  consensus: {
    passed: boolean;
    maxDiff: number;
    agreeingEngines: string[];
  };
}

/** Verify a derivation across multiple engines. */
export async function verifyCrossEngine(
  goal: Term,
  goalTruth: TruthValue,
  engines: Array<{
    name: string;
    version: string;
    execute: (goal: Term, goalTruth: TruthValue) => Promise<DerivationRecord>;
  }>,
  seed: number
): Promise<CrossEngineVerification> {
  const results: CrossEngineResult[] = [];
  const interpreter = createReferenceInterpreter();

  for (const engine of engines) {
    const record = await engine.execute(goal, goalTruth);
    const verification = interpreter.verify(record);
    results.push({ engine: engine.name, record, verification });
  }

  // Check consensus
  const allPassed = results.every(r => r.verification.passed);
  const maxDiff = Math.max(...results.map(r => r.verification.maxDiff), 0);
  const agreeingEngines = results.filter(r => r.verification.passed).map(r => r.engine);

  return {
    goal,
    goalTruth,
    results,
    consensus: {
      passed: allPassed,
      maxDiff,
      agreeingEngines,
    },
  };
}

/** Deterministic replay: re-execute a derivation from its record. */
export interface ReplayResult {
  originalRecord: DerivationRecord;
  replayedRecord: DerivationRecord;
  matches: boolean;
  differences: Array<{
    step: number;
    field: string;
    original: unknown;
    replayed: unknown;
  }>;
}

/** Replay a derivation deterministically. */
export function replayDerivation(
  record: DerivationRecord,
  engine: {
    name: string;
    version: string;
    step: (ruleId: RuleId, premises: Premise[]) => StepResult | null;
  }
): ReplayResult {
  const replayedSteps: DerivationStepRecord[] = [];
  const differences: ReplayResult['differences'] = [];

  for (let i = 0; i < record.steps.length; i++) {
    const originalStep = record.steps[i];
    if (!originalStep) continue;
    const premises = originalStep.premises.map(p => ({
      term: p.term,
      truth: p.truth,
      stamp: p.stamp,
    }));

    const replayedStep = engine.step(originalStep.ruleId, premises);

    if (!replayedStep) {
      differences.push({
        step: i,
        field: 'step',
        original: 'executed',
        replayed: 'null',
      });
      continue;
    }

    // Compare results
    if (!Truth.equals(replayedStep.truth, originalStep.truth)) {
      differences.push({
        step: i,
        field: 'truth',
        original: originalStep.truth,
        replayed: replayedStep.truth,
      });
    }

    if (replayedStep.conclusion !== originalStep.conclusion) {
      differences.push({
        step: i,
        field: 'conclusion',
        original: originalStep.conclusion,
        replayed: replayedStep.conclusion,
      });
    }

    // Record replayed step
    replayedSteps.push({
      ...originalStep,
      truth: replayedStep.truth,
      conclusion: replayedStep.conclusion,
      stamp: replayedStep.stamp,
    });
  }

  const replayedRecord: DerivationRecord = {
    ...record,
    steps: replayedSteps,
    conclusions: replayedSteps
      .filter(s => s.depth === Math.max(...replayedSteps.map(s => s.depth)))
      .map(s => ({ term: s.conclusion, truth: s.truth, stamp: s.stamp })),
  };

  return {
    originalRecord: record,
    replayedRecord,
    matches: differences.length === 0,
    differences,
  };
}

/** Verification oracle: checks if a derivation is valid. */
export interface VerificationOracle {
  /** Verify a single step. */
  verifyStep(step: DerivationStepRecord): Promise<{ valid: boolean; error?: string }>;
  /** Verify a full derivation. */
  verifyDerivation(record: DerivationRecord): Promise<DerivationVerificationResult>;
}

/** Create a verification oracle using the reference interpreter. */
export function createVerificationOracle(): VerificationOracle {
  const interpreter = createReferenceInterpreter();

  return {
    async verifyStep(step: DerivationStepRecord) {
      // Create a temporary record with just this step
      const tempRecord: DerivationRecord = {
        id: `step-${step.id}`,
        goal: step.conclusion,
        goalTruth: step.truth,
        steps: [step],
        conclusions: [{ term: step.conclusion, truth: step.truth, stamp: step.stamp }],
        success: true,
        startTs: step.ts,
        endTs: step.ts,
        stepCount: 1,
        engine: step.engine,
        engineVersion: step.engineVersion,
        seed: 0,
        oraclePins: step.oraclePin ? [step.oraclePin] : [],
      };
      const result = interpreter.verify(tempRecord);
      return { valid: result.passed, error: result.stepResults.filter(r => !r.passed).map(r => r.error).join(', ') };
    },

    async verifyDerivation(record: DerivationRecord) {
      return interpreter.verify(record);
    },
  };
}

/** Batch verification for multiple derivations. */
export async function batchVerify(
  records: DerivationRecord[],
  oracle: VerificationOracle,
  concurrency = 4
): Promise<DerivationVerificationResult[]> {
  const results: DerivationVerificationResult[] = [];

  for (let i = 0; i < records.length; i += concurrency) {
    const batch = records.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(r => oracle.verifyDerivation(r))
    );
    results.push(...batchResults);
  }

  return results;
}

/** Verification statistics. */
export interface VerificationStats {
  totalVerified: number;
  passed: number;
  failed: number;
  avgMaxDiff: number;
  maxDiff: number;
  byEngine: Record<string, { passed: number; failed: number }>;
}

/** Compute verification statistics. */
export function computeVerificationStats(
  results: DerivationVerificationResult[]
): VerificationStats {
  const stats: VerificationStats = {
    totalVerified: results.length,
    passed: 0,
    failed: 0,
    avgMaxDiff: 0,
    maxDiff: 0,
    byEngine: {},
  };

  let totalDiff = 0;
  for (const result of results) {
    if (result.passed) stats.passed++;
    else stats.failed++;
    totalDiff += result.maxDiff;
    stats.maxDiff = Math.max(stats.maxDiff, result.maxDiff);
  }

  stats.avgMaxDiff = stats.totalVerified > 0 ? totalDiff / stats.totalVerified : 0;

  return stats;
}