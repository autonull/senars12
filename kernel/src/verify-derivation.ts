/**
 * Runtime derivation-verification sampling — spot-check with dependency-free verifyRecord under budget.
 * Cheap in-run checker; complements CI verification.
 */

import type { DerivationRecord, DerivationStep, TruthValue } from './schemas.js';
import { createHash } from 'node:crypto';

export interface VerificationResult {
  readonly ok: boolean;
  readonly errors: string[];
  readonly stepResults: StepVerificationResult[];
  readonly verifiedAt: number;
}

export interface StepVerificationResult {
  readonly stepId: string;
  readonly ok: boolean;
  readonly errors: string[];
  readonly computedTruth?: TruthValue;
  readonly declaredTruth: TruthValue;
}

export interface VerifyOptions {
  readonly strict: boolean;
  readonly epsilon: number;
  readonly maxSteps?: number;
  readonly sampleRate?: number; // 0-1, fraction of steps to verify
}

export interface VerifyRecordOptions {
  readonly strict: boolean;
  readonly epsilon: number;
}

/** Standalone derivation verifier — no NAR engine dependencies. */
export function verifyRecord(record: DerivationRecord, options: VerifyRecordOptions): VerificationResult {
  const { strict, epsilon } = options;
  const errors: string[] = [];
  const stepResults: StepVerificationResult[] = [];

  // Verify each step
  const stepsToVerify = options.maxSteps ? record.steps.slice(0, options.maxSteps) : record.steps;

  for (const step of stepsToVerify) {
    const stepResult = verifyStep(step, strict, epsilon);
    stepResults.push(stepResult);
    if (!stepResult.ok) {
      errors.push(...stepResult.errors.map((e) => `Step ${step.stepId}: ${e}`));
    }
  }

  // Verify final truth matches last step
  const lastStep = record.steps[record.steps.length - 1];
  if (lastStep) {
    const truthDiff = Math.abs(lastStep.truth.frequency - record.finalTruth.frequency) +
                      Math.abs(lastStep.truth.confidence - record.finalTruth.confidence);
    if (truthDiff > epsilon) {
      errors.push(`Final truth mismatch: step truth (${lastStep.truth.frequency}, ${lastStep.truth.confidence}) vs record (${record.finalTruth.frequency}, ${record.finalTruth.confidence})`);
    }
  }

  // Verify derivation ID format
  if (!isValidUUID(record.derivationId)) {
    errors.push(`Invalid derivationId format: ${record.derivationId}`);
  }

  // Verify task ID format
  if (!isValidUUID(record.taskId)) {
    errors.push(`Invalid taskId format: ${record.taskId}`);
  }

  // Verify timestamps
  if (record.timestamp <= 0 || record.timestamp > Date.now() + 60000) {
    errors.push(`Invalid timestamp: ${record.timestamp}`);
  }

  // Verify engine
  if (record.engine !== 'nar') {
    errors.push(`Unknown engine: ${record.engine}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    stepResults,
    verifiedAt: Date.now(),
  };
}

/** Verify a single derivation step. */
function verifyStep(step: DerivationStep, strict: boolean, epsilon: number): StepVerificationResult {
  const errors: string[] = [];

  // Verify step ID format
  if (!isValidUUID(step.stepId)) {
    errors.push(`Invalid stepId format: ${step.stepId}`);
  }

  // Verify rule ID
  if (!step.ruleId || step.ruleId.trim() === '') {
    errors.push('Missing ruleId');
  }

  // Verify rule category
  const validCategories = [
    'core', 'logic', 'propositional', 'higher-order', 'comparison',
    'classical', 'structural', 'temporal', 'procedural', 'meta-cognitive', 'variable'
  ];
  if (!validCategories.includes(step.ruleCategory)) {
    errors.push(`Invalid ruleCategory: ${step.ruleCategory}`);
  }

  // Verify premises
  if (!step.premises || step.premises.length === 0) {
    errors.push('No premises provided');
  }

  // Verify conclusion
  if (!step.conclusion || step.conclusion.trim() === '') {
    errors.push('Missing conclusion');
  }

  // Verify truth values
  if (!isValidTruthValue(step.truth)) {
    errors.push(`Invalid truth value: ${JSON.stringify(step.truth)}`);
  }

  // Verify premise truths if present
  if (step.premiseTruths) {
    if (step.premiseTruths.length !== step.premises.length) {
      errors.push(`Premise truths count (${step.premiseTruths.length}) doesn't match premises count (${step.premises.length})`);
    }
    for (const pt of step.premiseTruths) {
      if (!isValidTruthValue(pt)) {
        errors.push(`Invalid premise truth: ${JSON.stringify(pt)}`);
      }
    }
  }

  // Verify evidence lineage
  if (step.evidenceLineage) {
    for (const lineageId of step.evidenceLineage) {
      if (!isValidUUID(lineageId)) {
        errors.push(`Invalid evidence lineage ID: ${lineageId}`);
      }
    }
  }

  // Verify independence
  const validIndependence = ['independent', 'dependent', 'unknown'];
  if (!validIndependence.includes(step.independence)) {
    errors.push(`Invalid independence: ${step.independence}`);
  }

  // In strict mode, do truth algebra verification
  let computedTruth: TruthValue | undefined;
  if (strict && step.premiseTruths && step.premiseTruths.length > 0) {
    computedTruth = computeInferredTruth(step.ruleCategory, step.premiseTruths);
    if (computedTruth) {
      const diff = Math.abs(computedTruth.frequency - step.truth.frequency) +
                   Math.abs(computedTruth.confidence - step.truth.confidence);
      if (diff > epsilon) {
        errors.push(`Truth algebra mismatch: computed (${computedTruth.frequency.toFixed(3)}, ${computedTruth.confidence.toFixed(3)}) vs declared (${step.truth.frequency.toFixed(3)}, ${step.truth.confidence.toFixed(3)})`);
      }
    }
  }

  return {
    stepId: step.stepId,
    ok: errors.length === 0,
    errors,
    computedTruth,
    declaredTruth: step.truth,
  };
}

/** Simple truth algebra computation for verification. */
function computeInferredTruth(ruleCategory: string, premiseTruths: TruthValue[]): TruthValue | null {
  // Simplified truth inference based on rule category
  // Real implementation would use the actual NAL truth functions
  if (premiseTruths.length === 0) return null;

  const avgFreq = premiseTruths.reduce((sum, t) => sum + t.frequency, 0) / premiseTruths.length;
  const avgConf = premiseTruths.reduce((sum, t) => sum + t.confidence, 0) / premiseTruths.length;

  // Different rules have different truth combination behaviors
  switch (ruleCategory) {
    case 'logic':
    case 'core':
      // Deduction-like: confidence decreases
      return { frequency: avgFreq, confidence: avgConf * 0.9 };
    case 'revision':
      // Revision: confidence increases
      return { frequency: avgFreq, confidence: Math.min(1, avgConf * 1.1) };
    default:
      return { frequency: avgFreq, confidence: avgConf };
  }
}

/** Validate truth value bounds. */
function isValidTruthValue(t: TruthValue): boolean {
  return typeof t.frequency === 'number' &&
         typeof t.confidence === 'number' &&
         t.frequency >= 0 && t.frequency <= 1 &&
         t.confidence >= 0 && t.confidence <= 1;
}

/** Validate UUID format. */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/** Budget-aware verification sampler. */
export class DerivationVerifier {
  private readonly budget: { maxVerificationsPerCycle: number; verificationsThisCycle: number };
  private readonly options: VerifyOptions;
  private cycleCount = 0;

  constructor(options: VerifyOptions = { strict: false, epsilon: 1e-6, sampleRate: 0.1 }) {
    this.options = {
      strict: options.strict ?? false,
      epsilon: options.epsilon ?? 1e-6,
      maxSteps: options.maxSteps,
      sampleRate: options.sampleRate ?? 0.1,
    };
    this.budget = {
      maxVerificationsPerCycle: Math.max(1, Math.floor(10 * (this.options.sampleRate ?? 0.1))),
      verificationsThisCycle: 0,
    };
  }

  /** Start a new cycle (resets budget). */
  newCycle(): void {
    this.cycleCount++;
    this.budget.verificationsThisCycle = 0;
  }

  /** Verify a derivation record if budget allows. */
  verify(record: DerivationRecord): VerificationResult | null {
    if (this.budget.verificationsThisCycle >= this.budget.maxVerificationsPerCycle) {
      return null; // Budget exhausted
    }

    // Sample: only verify a fraction of records
    if (Math.random() > (this.options.sampleRate ?? 0.1)) {
      return null;
    }

    this.budget.verificationsThisCycle++;
    return verifyRecord(record, {
      strict: this.options.strict,
      epsilon: this.options.epsilon,
    });
  }

  /** Verify multiple records. */
  verifyBatch(records: DerivationRecord[]): VerificationResult[] {
    const results: VerificationResult[] = [];
    for (const record of records) {
      const result = this.verify(record);
      if (result) results.push(result);
    }
    return results;
  }

  /** Get verifier stats. */
  getStats(): { cycleCount: number; verificationsThisCycle: number; budget: number } {
    return {
      cycleCount: this.cycleCount,
      verificationsThisCycle: this.budget.verificationsThisCycle,
      budget: this.budget.maxVerificationsPerCycle,
    };
  }
}

export function createDerivationVerifier(options?: VerifyOptions): DerivationVerifier {
  return new DerivationVerifier(options);
}