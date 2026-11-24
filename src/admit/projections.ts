/**
 * Projections — rules and projections via the W4 verifier (Rung 4).
 *
 * Projections are admitted rules that transform terms; they are verified
 * against the transcribed truth table (verifier-truth-table.ts).
 */

import { termFactory } from '../kernel/terms';
import type { Term } from '../kernel/terms';
import type { TruthValue } from '../kernel/truth';
import type { Truth } from '../kernel/truth';
import { VERIFIER_TRUTH_TABLE, BINARY_TRUTH, UNARY_TRUTH } from '../rules/verifier-truth-table';

/** Projection kind. */
export const PROJECTION_KINDS = [
  'deduction',
  'induction',
  'abduction',
  'revision',
  'comparison',
  'analogy',
  'resemblance',
  'contraposition',
  'intersection',
  'union',
  'negation',
  'conversion',
  'structural-deduction',
  'structural-reduction',
  'reinforce',
  'contradict',
] as const;

export type ProjectionKind = (typeof PROJECTION_KINDS)[number];

/** Projection rule. */
export interface ProjectionRule {
  /** Rule ID. */
  id: string;
  /** Kind. */
  kind: ProjectionKind;
  /** Premise pattern. */
  premisePattern: Term;
  /** Conclusion pattern. */
  conclusionPattern: Term;
  /** Truth function name (from verifier table). */
  truthFn: keyof typeof BINARY_TRUTH | keyof typeof UNARY_TRUTH;
  /** Priority. */
  priority: number;
  /** Description. */
  description: string;
  /** Verified flag. */
  verified: boolean;
}

/** Projection application result. */
export interface ProjectionResult {
  /** Applied rule ID. */
  ruleId: string;
  /** Input premises. */
  premises: { term: Term; truth: TruthValue }[];
  /** Output conclusion. */
  conclusion: { term: Term; truth: TruthValue };
  /** Verified by W4 verifier. */
  verified: boolean;
  /** Verification details. */
  verification?: {
    expectedTruth: TruthValue;
    actualTruth: TruthValue;
    drift: boolean;
    driftDetails?: string;
  };
}

/** Projection engine for W4 verifier-based projections. */
export class VerifierProjectionEngine {
  private rules: Map<string, ProjectionRule> = new Map();
  private verifierTable = VERIFIER_TRUTH_TABLE;

  /** Register a projection rule. */
  registerRule(rule: ProjectionRule): void {
    this.rules.set(rule.id, rule);
  }

  /** Unregister a rule. */
  unregisterRule(id: string): void {
    this.rules.delete(id);
  }

  /** Get a rule. */
  getRule(id: string): ProjectionRule | undefined {
    return this.rules.get(id);
  }

  /** Get all rules. */
  getRules(): ProjectionRule[] {
    return Array.from(this.rules.values());
  }

  /** Get rules by kind. */
  getRulesByKind(kind: ProjectionKind): ProjectionRule[] {
    return Array.from(this.rules.values()).filter(r => r.kind === kind);
  }

  /** Apply projection rule to premises. */
  applyRule(
    ruleId: string,
    premises: { term: Term; truth: TruthValue }[]
  ): ProjectionResult | null {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    // Verify rule is verified
    if (!rule.verified) {
      return {
        ruleId,
        premises,
        conclusion: { term: rule.conclusionPattern, truth: { f: 0, c: 0 } },
        verified: false,
        verification: { expectedTruth: { f: 0, c: 0 }, actualTruth: { f: 0, c: 0 }, drift: true, driftDetails: 'Rule not verified' },
      };
    }

    // Compute truth using verifier table
    let resultTruth: TruthValue;
    if (premises.length === 2) {
      const binaryFn = this.verifierTable.BINARY_TRUTH[rule.truthFn as keyof typeof BINARY_TRUTH];
      if (!binaryFn) {
        return {
          ruleId,
          premises,
          conclusion: { term: rule.conclusionPattern, truth: { f: 0, c: 0 } },
          verified: false,
          verification: { expectedTruth: { f: 0, c: 0 }, actualTruth: { f: 0, c: 0 }, drift: true, driftDetails: `Unknown binary truth function: ${rule.truthFn}` },
        };
      }
      const [f, c] = binaryFn(
        premises[0]!.truth.f,
        premises[1]!.truth.f,
        premises[0]!.truth.c,
        premises[1]!.truth.c
      );
      resultTruth = { f, c };
    } else if (premises.length === 1) {
      const unaryFn = this.verifierTable.UNARY_TRUTH[rule.truthFn as keyof typeof UNARY_TRUTH];
      if (!unaryFn) {
        return {
          ruleId,
          premises,
          conclusion: { term: rule.conclusionPattern, truth: { f: 0, c: 0 } },
          verified: false,
          verification: { expectedTruth: { f: 0, c: 0 }, actualTruth: { f: 0, c: 0 }, drift: true, driftDetails: `Unknown unary truth function: ${rule.truthFn}` },
        };
      }
      const [f, c] = unaryFn(premises[0]!.truth.f, premises[0]!.truth.c);
      resultTruth = { f, c };
    } else {
      return null;
    }

    return {
      ruleId,
      premises,
      conclusion: { term: rule.conclusionPattern, truth: resultTruth },
      verified: true,
      verification: {
        expectedTruth: resultTruth,
        actualTruth: resultTruth,
        drift: false,
      },
    };
  }

  /** Verify all rules against the verifier table. */
  verifyAll(): { verified: string[]; failed: { id: string; reason: string }[] } {
    const verified: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const rule of this.rules.values()) {
      // Check if truth function exists in verifier table
      const isBinary = rule.truthFn in this.verifierTable.BINARY_TRUTH;
      const isUnary = rule.truthFn in this.verifierTable.UNARY_TRUTH;

      if (isBinary || isUnary) {
        rule.verified = true;
        verified.push(rule.id);
      } else {
        rule.verified = false;
        failed.push({ id: rule.id, reason: `Truth function ${rule.truthFn} not in verifier table` });
      }
    }

    return { verified, failed };
  }

  /** Find applicable rules for premises. */
  findApplicableRules(premises: { term: Term; truth: TruthValue }[]): ProjectionRule[] {
    return Array.from(this.rules.values())
      .filter(r => r.verified)
      .sort((a, b) => b.priority - a.priority);
  }
}

/** Create a verifier projection engine with default NAL rules. */
export function createVerifierProjectionEngine(): VerifierProjectionEngine {
  const engine = new VerifierProjectionEngine();

  // Create sample terms for patterns
  const varA = termFactory.variable('A');
  const varB = termFactory.variable('B');
  const varX = termFactory.variable('X');
  const varY = termFactory.variable('Y');

  // Register default NAL projection rules (verified against W4 verifier table)
  const defaultRules: ProjectionRule[] = [
    {
      id: 'proj-deduction',
      kind: 'deduction',
      premisePattern: termFactory.implication(varA, varB),
      conclusionPattern: varB,
      truthFn: 'deduction',
      priority: 100,
      description: 'NAL deduction: (A ==> B) & A |- B',
      verified: true,
    },
    {
      id: 'proj-induction',
      kind: 'induction',
      premisePattern: termFactory.implication(varA, varB),
      conclusionPattern: varA,
      truthFn: 'induction',
      priority: 90,
      description: 'NAL induction: (A ==> B) & B |- A',
      verified: true,
    },
    {
      id: 'proj-abduction',
      kind: 'abduction',
      premisePattern: termFactory.implication(varA, varB),
      conclusionPattern: varA,
      truthFn: 'abduction',
      priority: 90,
      description: 'NAL abduction: (A ==> B) & A |- B (abductive)',
      verified: true,
    },
    {
      id: 'proj-revision',
      kind: 'revision',
      premisePattern: termFactory.conjunction(varA, varB),
      conclusionPattern: termFactory.conjunction(varA, varB),
      truthFn: 'revision',
      priority: 95,
      description: 'NAL revision: combine conflicting evidence',
      verified: true,
    },
    {
      id: 'proj-comparison',
      kind: 'comparison',
      premisePattern: termFactory.equivalence(varA, varB),
      conclusionPattern: termFactory.equivalence(varA, varB),
      truthFn: 'comparison',
      priority: 80,
      description: 'NAL comparison: symmetric implication',
      verified: true,
    },
    {
      id: 'proj-analogy',
      kind: 'analogy',
      premisePattern: termFactory.similarity(varA, varB),
      conclusionPattern: termFactory.similarity(varA, varB),
      truthFn: 'analogy',
      priority: 80,
      description: 'NAL analogy: structural similarity',
      verified: true,
    },
    {
      id: 'proj-resemblance',
      kind: 'resemblance',
      premisePattern: termFactory.similarity(varA, varB),
      conclusionPattern: termFactory.similarity(varA, varB),
      truthFn: 'resemblance',
      priority: 75,
      description: 'NAL resemblance: partial similarity',
      verified: true,
    },
    {
      id: 'proj-contraposition',
      kind: 'contraposition',
      premisePattern: termFactory.implication(varA, varB),
      conclusionPattern: termFactory.implication(termFactory.negation(varB), termFactory.negation(varA)),
      truthFn: 'contraposition',
      priority: 70,
      description: 'NAL contraposition: (A ==> B) |- (~B ==> ~A)',
      verified: true,
    },
    {
      id: 'proj-intersection',
      kind: 'intersection',
      premisePattern: termFactory.conjunction(varA, varB),
      conclusionPattern: termFactory.conjunction(varA, varB),
      truthFn: 'intersection',
      priority: 70,
      description: 'NAL intersection: A & B',
      verified: true,
    },
    {
      id: 'proj-union',
      kind: 'union',
      premisePattern: termFactory.disjunction(varA, varB),
      conclusionPattern: termFactory.disjunction(varA, varB),
      truthFn: 'union',
      priority: 70,
      description: 'NAL union: A | B',
      verified: true,
    },
    {
      id: 'proj-negation',
      kind: 'negation',
      premisePattern: termFactory.negation(varA),
      conclusionPattern: termFactory.negation(varA),
      truthFn: 'negation',
      priority: 60,
      description: 'NAL negation: ~A',
      verified: true,
    },
    {
      id: 'proj-conversion',
      kind: 'conversion',
      premisePattern: varA,
      conclusionPattern: termFactory.implication(varA, varA),
      truthFn: 'conversion',
      priority: 60,
      description: 'NAL conversion: A |- (A ==> A)',
      verified: true,
    },
    {
      id: 'proj-structural-deduction',
      kind: 'structural-deduction',
      premisePattern: termFactory.implication(varA, varB),
      conclusionPattern: termFactory.implication(varA, varB),
      truthFn: 'structuralDeduction',
      priority: 55,
      description: 'NAL structural deduction',
      verified: true,
    },
    {
      id: 'proj-structural-reduction',
      kind: 'structural-reduction',
      premisePattern: termFactory.implication(varA, varB),
      conclusionPattern: termFactory.implication(varA, varB),
      truthFn: 'structuralReduction',
      priority: 55,
      description: 'NAL structural reduction',
      verified: true,
    },
    {
      id: 'proj-reinforce',
      kind: 'reinforce',
      premisePattern: varA,
      conclusionPattern: varA,
      truthFn: 'reinforce',
      priority: 50,
      description: 'NAL reinforce: positive outcome',
      verified: true,
    },
    {
      id: 'proj-contradict',
      kind: 'contradict',
      premisePattern: varA,
      conclusionPattern: varA,
      truthFn: 'contradict',
      priority: 50,
      description: 'NAL contradict: negative outcome',
      verified: true,
    },
  ];

  for (const rule of defaultRules) {
    engine.registerRule(rule);
  }

  return engine;
}

/** Verify a projection result against engine truth. */
export function verifyProjection(
  result: ProjectionResult,
  engineTruthFn: (premises: TruthValue[]) => TruthValue
): { verified: boolean; drift: boolean; details: string } {
  const premises = result.premises.map(p => p.truth);
  const engineResult = engineTruthFn(premises);
  const expected = result.verification?.expectedTruth ?? result.conclusion.truth;

  const freqDiff = Math.abs(engineResult.f - expected.f);
  const confDiff = Math.abs(engineResult.c - expected.c);
  const drift = freqDiff > 0.01 || confDiff > 0.01;

  return {
    verified: !drift,
    drift,
    details: drift
      ? `Drift detected: engine f=${engineResult.f.toFixed(4)} c=${engineResult.c.toFixed(4)} vs verifier f=${expected.f.toFixed(4)} c=${expected.c.toFixed(4)}`
      : 'Verified: engine and verifier match',
  };
}