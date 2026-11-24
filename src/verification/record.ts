/**
 * Verification Record — derivation recording for replay and verification.
 *
 * Every derivation step is recorded with full provenance for:
 * - Deterministic replay
 * - Cross-engine verification
 * - Audit trail
 * - Proof certificates
 */

import { Term } from '../kernel/terms/intern';
import { TruthValue } from '../kernel/truth';
import { Stamp } from '../kernel/stamp';
import type { RuleId, RuleCategory } from '../kernel/step';

/** A single derivation step record. */
export interface DerivationStepRecord {
  /** Unique step ID. */
  id: string;
  /** Sequence number. */
  seq: number;
  /** Timestamp. */
  ts: number;
  /** Rule applied. */
  ruleId: RuleId;
  /** Rule category. */
  ruleCategory: RuleCategory;
  /** Premise term IDs. */
  premiseIds: string[];
  /** Premise terms (for standalone verification). */
  premises: Array<{ term: Term; truth: TruthValue; stamp: Stamp }>;
  /** Conclusion term. */
  conclusion: Term;
  /** Conclusion truth. */
  truth: TruthValue;
  /** Conclusion stamp. */
  stamp: Stamp;
  /** Truth operation used. */
  truthOp: string;
  /** Derivation depth. */
  depth: number;
  /** Engine that produced this step. */
  engine: string;
  /** Engine version. */
  engineVersion: string;
  /** Optional: oracle pin ID if external call was made. */
  oraclePin?: string;
  /** Optional: custom metadata. */
  meta?: Record<string, unknown>;
}

/** Complete derivation record. */
export interface DerivationRecord {
  /** Record ID. */
  id: string;
  /** Goal/query that initiated derivation. */
  goal: Term;
  /** Goal truth threshold. */
  goalTruth: TruthValue;
  /** Steps in derivation. */
  steps: DerivationStepRecord[];
  /** Final conclusions. */
  conclusions: Array<{ term: Term; truth: TruthValue; stamp: Stamp }>;
  /** Whether goal was achieved. */
  success: boolean;
  /** Start timestamp. */
  startTs: number;
  /** End timestamp. */
  endTs: number;
  /** Total steps. */
  stepCount: number;
  /** Engine used. */
  engine: string;
  /** Engine version. */
  engineVersion: string;
  /** Random seed for reproducibility. */
  seed: number;
  /** Oracle pins used. */
  oraclePins: string[];
  /** Custom metadata. */
  meta?: Record<string, unknown>;
}

/** Verification result for a derivation step. */
export interface StepVerificationResult {
  stepId: string;
  /** Whether step verification passed. */
  passed: boolean;
  /** Expected truth. */
  expectedTruth: TruthValue;
  /** Actual truth from re-computation. */
  actualTruth: TruthValue;
  /** Difference. */
  diff: number;
  /** Error message if failed. */
  error?: string;
}

/** Verification result for a full derivation. */
export interface DerivationVerificationResult {
  recordId: string;
  /** Whether all steps passed. */
  passed: boolean;
  /** Step-by-step results. */
  stepResults: StepVerificationResult[];
  /** Overall truth difference. */
  maxDiff: number;
  /** Summary. */
  summary: {
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    maxTruthDiff: number;
  };
}

/** Record a derivation step. */
export function recordStep(
  step: {
    ruleId: RuleId;
    ruleCategory: RuleCategory;
    premises: Array<{ term: Term; truth: TruthValue; stamp: Stamp }>;
    conclusion: Term;
    truth: TruthValue;
    stamp: Stamp;
    truthOp: string;
    depth: number;
    engine: string;
    engineVersion: string;
    oraclePin?: string;
    meta?: Record<string, unknown>;
  },
  seq: number
): DerivationStepRecord {
  return {
    id: `step-${seq}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    seq,
    ts: Date.now(),
    ruleId: step.ruleId,
    ruleCategory: step.ruleCategory,
    premiseIds: step.premises.map(p => p.stamp.id),
    premises: step.premises,
    conclusion: step.conclusion,
    truth: step.truth,
    stamp: step.stamp,
    truthOp: step.truthOp,
    depth: step.depth,
    engine: step.engine,
    engineVersion: step.engineVersion,
    oraclePin: step.oraclePin,
    meta: step.meta,
  };
}

/** Create a complete derivation record. */
export function createDerivationRecord(
  goal: Term,
  goalTruth: TruthValue,
  steps: DerivationStepRecord[],
  engine: string,
  engineVersion: string,
  seed: number,
  oraclePins: string[] = []
): DerivationRecord {
  const conclusions = steps
    .filter(s => s.depth === Math.max(...steps.map(s => s.depth)))
    .map(s => ({ term: s.conclusion, truth: s.truth, stamp: s.stamp }));

  const success = conclusions.some(c => c.truth.f >= goalTruth.f && c.truth.c >= goalTruth.c);

  return {
    id: `derivation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    goal,
    goalTruth,
    steps,
    conclusions,
    success,
    startTs: steps[0]?.ts ?? Date.now(),
    endTs: Date.now(),
    stepCount: steps.length,
    engine,
    engineVersion,
    seed,
    oraclePins,
  };
}

/** Verify a single derivation step by re-computing truth. */
export function verifyStep(
  step: DerivationStepRecord,
  truthFn: (premises: Array<{ term: Term; truth: TruthValue; stamp: Stamp }>) => TruthValue | null
): StepVerificationResult {
  const actualTruth = truthFn(step.premises);
  if (!actualTruth) {
    return {
      stepId: step.id,
      passed: false,
      expectedTruth: step.truth,
      actualTruth: { f: 0, c: 0 },
      diff: 1,
      error: 'Truth function returned null',
    };
  }

  const diff = Math.abs(actualTruth.f - step.truth.f) + Math.abs(actualTruth.c - step.truth.c);
  const passed = diff < 1e-6;

  return {
    stepId: step.id,
    passed,
    expectedTruth: step.truth,
    actualTruth,
    diff,
    error: passed ? undefined : `Truth mismatch: expected ${JSON.stringify(step.truth)}, got ${JSON.stringify(actualTruth)}`,
  };
}

/** Verify a complete derivation record. */
export function verifyDerivation(
  record: DerivationRecord,
  truthFn: (premises: Array<{ term: Term; truth: TruthValue; stamp: Stamp }>) => TruthValue | null
): DerivationVerificationResult {
  const stepResults = record.steps.map(step => verifyStep(step, truthFn));
  const passed = stepResults.every(r => r.passed);
  const maxDiff = Math.max(...stepResults.map(r => r.diff), 0);

  return {
    recordId: record.id,
    passed,
    stepResults,
    maxDiff,
    summary: {
      totalSteps: record.steps.length,
      passedSteps: stepResults.filter(r => r.passed).length,
      failedSteps: stepResults.filter(r => !r.passed).length,
      maxTruthDiff: maxDiff,
    },
  };
}

/** Serialize derivation record to JSON. */
export function serializeDerivationRecord(record: DerivationRecord): string {
  return JSON.stringify(record, (key, value) => {
    if (typeof value === 'bigint') return value.toString();
    return value;
  });
}

/** Deserialize derivation record from JSON. */
export function deserializeDerivationRecord(json: string): DerivationRecord {
  return JSON.parse(json);
}

/** Derivation recorder for collecting steps during execution. */
export class DerivationRecorder {
  private steps: DerivationStepRecord[] = [];
  private seq = 0;
  private engine: string;
  private engineVersion: string;
  private oraclePins: string[] = [];

  constructor(engine: string, engineVersion: string) {
    this.engine = engine;
    this.engineVersion = engineVersion;
  }

  /** Record a step. */
  record(step: Omit<DerivationStepRecord, 'id' | 'seq' | 'ts'>): DerivationStepRecord {
    this.seq++;
    const recorded = recordStep(step, this.seq);
    this.steps.push(recorded);
    if (step.oraclePin) this.oraclePins.push(step.oraclePin);
    return recorded;
  }

  /** Get all recorded steps. */
  getSteps(): DerivationStepRecord[] {
    return [...this.steps];
  }

  /** Finalize and create derivation record. */
  finalize(goal: Term, goalTruth: TruthValue, seed: number): DerivationRecord {
    const record = createDerivationRecord(
      goal,
      goalTruth,
      this.steps,
      this.engine,
      this.engineVersion,
      seed,
      this.oraclePins
    );
    this.steps = [];
    this.seq = 0;
    this.oraclePins = [];
    return record;
  }

  /** Clear without finalizing. */
  clear(): void {
    this.steps = [];
    this.seq = 0;
    this.oraclePins = [];
  }

  /** Get current step count. */
  getStepCount(): number {
    return this.steps.length;
  }
}

/** Create a derivation recorder. */
export function createDerivationRecorder(engine: string, engineVersion: string): DerivationRecorder {
  return new DerivationRecorder(engine, engineVersion);
}

/** Export derivation as proof certificate. */
export interface ProofCertificate {
  derivationId: string;
  goal: Term;
  conclusion: Term;
  truth: TruthValue;
  steps: Array<{
    rule: RuleId;
    premises: string[];
    conclusion: string;
    truth: TruthValue;
  }>;
  verified: boolean;
  verifier: string;
  timestamp: number;
}

export function createProofCertificate(
  record: DerivationRecord,
  verification: DerivationVerificationResult,
  verifier: string
): ProofCertificate {
  return {
    derivationId: record.id,
    goal: record.goal,
    conclusion: record.conclusions[0]?.term ?? record.goal,
    truth: record.conclusions[0]?.truth ?? { f: 0, c: 0 },
    steps: record.steps.map(s => ({
      rule: s.ruleId,
      premises: s.premiseIds,
      conclusion: s.stamp.id,
      truth: s.truth,
    })),
    verified: verification.passed,
    verifier,
    timestamp: Date.now(),
  };
}

/** Verify proof certificate. */
export function verifyProofCertificate(
  certificate: ProofCertificate,
  truthFn: (premises: Array<{ term: Term; truth: TruthValue; stamp: Stamp }>) => TruthValue | null,
  stampStore: Map<string, Stamp>,
  termStore: Map<string, Term>
): DerivationVerificationResult {
  // Reconstruct steps from certificate
  const steps: DerivationStepRecord[] = certificate.steps.map((s, i) => ({
    id: s.conclusion,
    seq: i,
    ts: certificate.timestamp,
    ruleId: s.rule,
    ruleCategory: 'deduction', // Would need to be stored
    premiseIds: s.premises,
    premises: s.premises.map(id => ({
      term: termStore.get(id)!,
      truth: { f: 0.5, c: 0.9 }, // Would need to be stored
      stamp: stampStore.get(id)!,
    })),
    conclusion: termStore.get(s.conclusion)!,
    truth: s.truth,
    stamp: stampStore.get(s.conclusion)!,
    truthOp: 'deduction',
    depth: i,
    engine: certificate.verifier,
    engineVersion: '1.0',
  }));

  const lastStep = certificate.steps[certificate.steps.length - 1];
    const lastStamp = lastStep ? stampStore.get(lastStep.conclusion) : undefined;
    const record: DerivationRecord = {
      id: certificate.derivationId,
      goal: certificate.goal,
      goalTruth: certificate.truth,
      steps,
      conclusions: [{ term: certificate.conclusion, truth: certificate.truth, stamp: lastStamp! }],
      success: certificate.verified,
      startTs: certificate.timestamp,
      endTs: certificate.timestamp,
      stepCount: steps.length,
      engine: certificate.verifier,
      engineVersion: '1.0',
      seed: 0,
      oraclePins: [],
    };

  return verifyDerivation(record, truthFn);
}