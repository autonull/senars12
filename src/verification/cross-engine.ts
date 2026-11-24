/**
 * Cross-Engine Verification — verify derivations across multiple engines.
 *
 * This module provides the infrastructure for running the same derivation
 * on multiple reasoning engines (NAL, SLD, SMT, ASP) and comparing
 * results for consistency.
 */

import { Term } from '../kernel/terms/intern';
import { TruthValue } from '../kernel/truth';
import { DerivationRecord, DerivationStepRecord } from './record';
import { ReferenceInterpreter, verifyCrossEngine, CrossEngineVerification } from './interpreter';

/** Engine interface for cross-engine verification. */
export interface VerificationEngine {
  /** Engine name. */
  name: string;
  /** Engine version. */
  version: string;
  /** Execute a derivation from goal to conclusions. */
  derive(goal: Term, goalTruth: TruthValue, seed: number): Promise<DerivationRecord>;
  /** Execute a single step. */
  step(ruleId: string, premises: Array<{ term: Term; truth: TruthValue }>): Promise<{ conclusion: Term; truth: TruthValue } | null>;
  /** Check if engine supports a rule. */
  supportsRule(ruleId: string): boolean;
}

/** Engine adapter for NAL engine. */
export function createNALAdapter(engine: {
  name: string;
  version: string;
  derive: (goal: Term, goalTruth: TruthValue, seed: number) => Promise<DerivationRecord>;
  step: (ruleId: string, premises: Array<{ term: Term; truth: TruthValue }>) => Promise<{ conclusion: Term; truth: TruthValue } | null>;
}): VerificationEngine {
  return {
    name: engine.name,
    version: engine.version,
    derive: engine.derive,
    step: engine.step,
    supportsRule: (ruleId) => {
      // NAL supports all core rules
      const nalRules = ['deduction', 'induction', 'abduction', 'revision',
        'comparison', 'analogy', 'resemblance',
        'negation', 'conversion_inheritance', 'conversion_similarity',
        'structural_deduction', 'prediction', 'postdiction'];
      return nalRules.includes(ruleId);
    },
  };
}

/** Engine adapter for SLD resolution. */
export function createSLDAdapter(engine: {
  name: string;
  version: string;
  derive: (goal: Term, goalTruth: TruthValue, seed: number) => Promise<DerivationRecord>;
  step: (ruleId: string, premises: Array<{ term: Term; truth: TruthValue }>) => Promise<{ conclusion: Term; truth: TruthValue } | null>;
}): VerificationEngine {
  return {
    name: engine.name,
    version: engine.version,
    derive: engine.derive,
    step: engine.step,
    supportsRule: (ruleId) => {
      // SLD supports deduction-like rules
      return ['deduction', 'revision'].includes(ruleId);
    },
  };
}

/** Engine adapter for SMT solver. */
export function createSMTAdapter(engine: {
  name: string;
  version: string;
  derive: (goal: Term, goalTruth: TruthValue, seed: number) => Promise<DerivationRecord>;
  step: (ruleId: string, premises: Array<{ term: Term; truth: TruthValue }>) => Promise<{ conclusion: Term; truth: TruthValue } | null>;
}): VerificationEngine {
  return {
    name: engine.name,
    version: engine.version,
    derive: engine.derive,
    step: engine.step,
    supportsRule: (ruleId) => {
      // SMT supports logical rules
      return ['deduction', 'revision', 'negation', 'comparison'].includes(ruleId);
    },
  };
}

/** Engine adapter for ASP (Answer Set Programming). */
export function createASPAdapter(engine: {
  name: string;
  version: string;
  derive: (goal: Term, goalTruth: TruthValue, seed: number) => Promise<DerivationRecord>;
  step: (ruleId: string, premises: Array<{ term: Term; truth: TruthValue }>) => Promise<{ conclusion: Term; truth: TruthValue } | null>;
}): VerificationEngine {
  return {
    name: engine.name,
    version: engine.version,
    derive: engine.derive,
    step: engine.step,
    supportsRule: (ruleId) => {
      // ASP supports rules with negation as failure
      return ['deduction', 'revision', 'negation', 'induction'].includes(ruleId);
    },
  };
}

/** Cross-engine verification orchestrator. */
export class CrossEngineVerifier {
  private engines: VerificationEngine[] = [];
  private interpreter = new ReferenceInterpreter();

  /** Add an engine. */
  addEngine(engine: VerificationEngine): void {
    this.engines.push(engine);
  }

  /** Remove an engine. */
  removeEngine(name: string): boolean {
    const idx = this.engines.findIndex(e => e.name === name);
    if (idx >= 0) {
      this.engines.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** Get all engines. */
  getEngines(): VerificationEngine[] {
    return [...this.engines];
  }

  /** Verify a goal across all engines. */
  async verify(goal: Term, goalTruth: TruthValue, seed: number): Promise<CrossEngineVerification> {
    const engineConfigs = this.engines.map(e => ({
      name: e.name,
      version: e.version,
      execute: (g: Term, gt: TruthValue) => e.derive(g, gt, seed),
    }));

    return verifyCrossEngine(goal, goalTruth, engineConfigs, seed);
  }

  /** Verify a specific rule across engines that support it. */
  async verifyRule(
    ruleId: string,
    premises: Array<{ term: Term; truth: TruthValue }>,
    seed: number
  ): Promise<{
    ruleId: string;
    results: Array<{
      engine: string;
      conclusion?: Term;
      truth?: TruthValue;
      error?: string;
    }>;
    consensus: {
      passed: boolean;
      agreeingEngines: string[];
      maxTruthDiff: number;
    };
  }> {
    const supportingEngines = this.engines.filter(e => e.supportsRule(ruleId));
    const results: Array<{ engine: string; conclusion?: Term; truth?: TruthValue; error?: string }> = [];

    for (const engine of supportingEngines) {
      try {
        const result = await engine.step(ruleId, premises);
        results.push({
          engine: engine.name,
          conclusion: result?.conclusion,
          truth: result?.truth,
        });
      } catch (error) {
        results.push({
          engine: engine.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Check consensus
    const successful = results.filter(r => r.truth !== undefined);
    let passed = true;
    let maxTruthDiff = 0;
    const agreeingEngines: string[] = [];

    if (successful.length >= 2) {
      const first = successful[0];
      if (!first || !first.truth) { passed = false; }
      else {
        const firstTruth = first.truth;
        for (let i = 1; i < successful.length; i++) {
          const s = successful[i];
          if (!s || !s.truth) continue;
          const diff = Math.abs(s.truth.f - firstTruth.f) +
            Math.abs(s.truth.c - firstTruth.c);
          maxTruthDiff = Math.max(maxTruthDiff, diff);
          if (diff > 1e-6) {
            passed = false;
          } else {
            agreeingEngines.push(s.engine);
          }
        }
        if (passed) agreeingEngines.unshift(first.engine);
      }
    } else if (successful.length === 1) {
      const s = successful[0];
      if (s) agreeingEngines.push(s.engine);
    } else {
      passed = false;
    }

    return { ruleId, results, consensus: { passed, agreeingEngines, maxTruthDiff } };
  }

  /** Batch verify multiple goals. */
  async batchVerify(
    goals: Array<{ goal: Term; goalTruth: TruthValue }>,
    seed: number,
    concurrency = 4
  ): Promise<CrossEngineVerification[]> {
    const results: CrossEngineVerification[] = [];

    for (let i = 0; i < goals.length; i += concurrency) {
      const batch = goals.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(g => this.verify(g.goal, g.goalTruth, seed))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /** Get verification statistics across engines. */
  async getEngineStats(): Promise<Record<string, { rulesSupported: number; avgLatency: number }>> {
    const stats: Record<string, { rulesSupported: number; avgLatency: number }> = {};

    for (const engine of this.engines) {
      const allRules = [
        'deduction', 'induction', 'abduction', 'revision',
        'comparison', 'analogy', 'resemblance',
        'negation', 'conversion_inheritance', 'conversion_similarity',
        'structural_deduction', 'prediction', 'postdiction',
      ];
      const supported = allRules.filter(r => engine.supportsRule(r)).length;

      stats[engine.name] = {
        rulesSupported: supported,
        avgLatency: 0, // Would need benchmarking
      };
    }

    return stats;
  }
}

/** Create a cross-engine verifier. */
export function createCrossEngineVerifier(): CrossEngineVerifier {
  return new CrossEngineVerifier();
}

/** Verification policy for CI/CD. */
export interface VerificationPolicy {
  /** Minimum engines that must agree. */
  minAgreeingEngines: number;
  /** Maximum allowed truth difference. */
  maxTruthDiff: number;
  /** Required engines (must all pass). */
  requiredEngines: string[];
  /** Optional engines (at least one must pass). */
  optionalEngines: string[];
  /** Fail verification if any required engine fails. */
  failOnRequiredFailure: boolean;
}

/** Default verification policy. */
export const defaultVerificationPolicy: VerificationPolicy = {
  minAgreeingEngines: 2,
  maxTruthDiff: 1e-6,
  requiredEngines: ['nal-reference'],
  optionalEngines: ['sld', 'smt', 'asp'],
  failOnRequiredFailure: true,
};

/** Apply verification policy to results. */
export function applyVerificationPolicy(
  verification: CrossEngineVerification,
  policy: VerificationPolicy
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check required engines
  for (const required of policy.requiredEngines) {
    const result = verification.results.find(r => r.engine === required);
    if (!result) {
      violations.push(`Required engine ${required} not found`);
    } else if (!result.verification.passed) {
      violations.push(`Required engine ${required} failed verification`);
    }
  }

  // Check minimum agreeing engines
  const agreeingCount = verification.consensus.agreeingEngines.length;
  if (agreeingCount < policy.minAgreeingEngines) {
    violations.push(`Only ${agreeingCount} engines agree, minimum ${policy.minAgreeingEngines} required`);
  }

  // Check max truth diff
  if (verification.consensus.maxDiff > policy.maxTruthDiff) {
    violations.push(`Max truth diff ${verification.consensus.maxDiff} exceeds threshold ${policy.maxTruthDiff}`);
  }

  // Check optional engines (at least one)
  const optionalPassed = policy.optionalEngines.some(e =>
    verification.results.find(r => r.engine === e)?.verification.passed
  );
  if (policy.optionalEngines.length > 0 && !optionalPassed) {
    violations.push('No optional engine passed');
  }

  const passed = violations.length === 0;
  if (!passed && policy.failOnRequiredFailure) {
    // Check if failure is from required engine
    const requiredFailed = policy.requiredEngines.some(req =>
      verification.results.find(r => r.engine === req)?.verification.passed === false
    );
    if (requiredFailed) return { passed: false, violations };
  }

  return { passed, violations };
}

/** Generate cross-engine test matrix. */
export interface TestMatrixEntry {
  goal: Term;
  goalTruth: TruthValue;
  category: string;
  expectedEngines: string[];
}

export function generateTestMatrix(): TestMatrixEntry[] {
  return [
    // Basic deduction
    { goal: createTerm('A'), goalTruth: { f: 1.0, c: 0.9 }, category: 'deduction', expectedEngines: ['nal', 'sld', 'smt'] },
    // Induction
    { goal: createTerm('B'), goalTruth: { f: 0.8, c: 0.7 }, category: 'induction', expectedEngines: ['nal', 'asp'] },
    // Abduction
    { goal: createTerm('C'), goalTruth: { f: 0.7, c: 0.6 }, category: 'abduction', expectedEngines: ['nal', 'asp'] },
    // Revision
    { goal: createTerm('D'), goalTruth: { f: 0.5, c: 0.5 }, category: 'revision', expectedEngines: ['nal', 'sld', 'smt', 'asp'] },
    // Negation
    { goal: createTerm('E'), goalTruth: { f: 0.0, c: 0.9 }, category: 'negation', expectedEngines: ['nal', 'smt', 'asp'] },
    // Temporal
    { goal: createTerm('F'), goalTruth: { f: 0.8, c: 0.6 }, category: 'temporal', expectedEngines: ['nal'] },
  ];
}

function createTerm(name: string): Term {
  return { op: 'CONSTANT' as const, value: name, hash: 0, complexity: 1 } as any;
}

/** Run verification matrix. */
export async function runVerificationMatrix(
  verifier: CrossEngineVerifier,
  matrix: TestMatrixEntry[],
  seed: number
): Promise<Array<{ entry: TestMatrixEntry; result: CrossEngineVerification; policy: { passed: boolean; violations: string[] } }>> {
  const results = [];

  for (const entry of matrix) {
    const result = await verifier.verify(entry.goal, entry.goalTruth, seed);
    const policy = applyVerificationPolicy(result, defaultVerificationPolicy);
    results.push({ entry, result, policy });
  }

  return results;
}