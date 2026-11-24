/**
 * Reference Vectors — canonical test vectors for verification.
 *
 * Reference vectors are fixed input/output pairs that define
 * the expected behavior of the system. They are used for:
 * - Regression testing
 * - Cross-engine verification
 * - Golden replay validation
 */

import { Term, TermOp } from '../kernel/terms/intern';
import { TruthValue } from '../kernel/truth';
import { Truth } from '../kernel/truth';
import type { RuleId, RuleCategory, Premise, StepResult } from '../kernel/step';
import { DerivationRecord, DerivationStepRecord } from './record';
import { Stamp } from '../kernel/stamp';

/** A reference vector: input -> expected output. */
export interface ReferenceVector {
  /** Unique vector ID. */
  id: string;
  /** Vector category. */
  category: VectorCategory;
  /** Description. */
  description: string;
  /** Input premises. */
  input: Premise[];
  /** Rule applied. */
  ruleId: RuleId;
  /** Rule category. */
  ruleCategory: RuleCategory;
  /** Expected conclusion term (structure). */
  expectedConclusion: Term;
  /** Expected truth value. */
  expectedTruth: TruthValue;
  /** Expected stamp properties. */
  expectedStamp: {
    evidence: number;
    derivation: string[];
  };
  /** Tolerance for truth comparison. */
  tolerance?: number;
}

/** Vector categories. */
export type VectorCategory =
  | 'truth_algebra'
  | 'deduction'
  | 'induction'
  | 'abduction'
  | 'revision'
  | 'comparison'
  | 'analogy'
  | 'resemblance'
  | 'structural'
  | 'temporal'
  | 'gate'
  | 'budget'
  | 'full_derivation'
  | 'meta';

/** All reference vectors. */
export const REFERENCE_VECTORS: ReferenceVector[] = [
  // ========================================================================
  // TRUTH ALGEBRA VECTORS
  // ========================================================================

  // Negation
  {
    id: 'truth_negation_1',
    category: 'truth_algebra',
    description: 'Negation of TRUE',
    input: [{ term: createTerm('TRUE'), truth: Truth.TRUE, stamp: createStamp(0) }],
    ruleId: 'negation',
    ruleCategory: 'structural',
    expectedConclusion: createTerm('FALSE'),
    expectedTruth: Truth.FALSE,
    expectedStamp: { evidence: 1, derivation: ['negation'] },
  },
  {
    id: 'truth_negation_2',
    category: 'truth_algebra',
    description: 'Negation of FALSE',
    input: [{ term: createTerm('FALSE'), truth: Truth.FALSE, stamp: createStamp(0) }],
    ruleId: 'negation',
    ruleCategory: 'structural',
    expectedConclusion: createTerm('TRUE'),
    expectedTruth: Truth.TRUE,
    expectedStamp: { evidence: 1, derivation: ['negation'] },
  },
  {
    id: 'truth_negation_3',
    category: 'truth_algebra',
    description: 'Negation of NEUTRAL',
    input: [{ term: createTerm('NEUTRAL'), truth: Truth.NEUTRAL, stamp: createStamp(0) }],
    ruleId: 'negation',
    ruleCategory: 'structural',
    expectedConclusion: createTerm('NEUTRAL'),
    expectedTruth: Truth.NEUTRAL,
    expectedStamp: { evidence: 1, derivation: ['negation'] },
  },

  // Conversion
  {
    id: 'truth_conversion_1',
    category: 'truth_algebra',
    description: 'Conversion of TRUE (inheritance)',
    input: [{ term: createInheritance('A', 'B'), truth: Truth.TRUE, stamp: createStamp(0) }],
    ruleId: 'conversion_inheritance',
    ruleCategory: 'structural',
    expectedConclusion: createInheritance('B', 'A'),
    expectedTruth: Truth.TRUE,
    expectedStamp: { evidence: 1, derivation: ['conversion_inheritance'] },
  },

  // Deduction
  {
    id: 'truth_deduction_1',
    category: 'truth_algebra',
    description: 'Deduction TRUE o TRUE = TRUE',
    input: [
      { term: createInheritance('A', 'B'), truth: Truth.TRUE, stamp: createStamp(0) },
      { term: createInheritance('B', 'C'), truth: Truth.TRUE, stamp: createStamp(0) },
    ],
    ruleId: 'deduction',
    ruleCategory: 'deduction',
    expectedConclusion: createInheritance('A', 'C'),
    expectedTruth: Truth.TRUE,
    expectedStamp: { evidence: 1, derivation: ['deduction'] },
  },
  {
    id: 'truth_deduction_2',
    category: 'truth_algebra',
    description: 'Deduction FALSE o TRUE = FALSE',
    input: [
      { term: createInheritance('A', 'B'), truth: Truth.FALSE, stamp: createStamp(0) },
      { term: createInheritance('B', 'C'), truth: Truth.TRUE, stamp: createStamp(0) },
    ],
    ruleId: 'deduction',
    ruleCategory: 'deduction',
    expectedConclusion: createInheritance('A', 'C'),
    expectedTruth: Truth.FALSE,
    expectedStamp: { evidence: 1, derivation: ['deduction'] },
  },
  {
    id: 'truth_deduction_3',
    category: 'truth_algebra',
    description: 'Deduction NEUTRAL o NEUTRAL',
    input: [
      { term: createInheritance('A', 'B'), truth: Truth.NEUTRAL, stamp: createStamp(0) },
      { term: createInheritance('B', 'C'), truth: Truth.NEUTRAL, stamp: createStamp(0) },
    ],
    ruleId: 'deduction',
    ruleCategory: 'deduction',
    expectedConclusion: createInheritance('A', 'C'),
    expectedTruth: { f: 0.25, c: 0.81 },
    expectedStamp: { evidence: 1, derivation: ['deduction'] },
    tolerance: 0.01,
  },

  // Induction
  {
    id: 'truth_induction_1',
    category: 'truth_algebra',
    description: 'Induction TRUE, TRUE',
    input: [
      { term: createInheritance('A', 'B'), truth: Truth.TRUE, stamp: createStamp(0) },
      { term: createInheritance('C', 'B'), truth: Truth.TRUE, stamp: createStamp(0) },
    ],
    ruleId: 'induction',
    ruleCategory: 'induction',
    expectedConclusion: createInheritance('A', 'C'),
    expectedTruth: { f: 1.0, c: 0.9 },
    expectedStamp: { evidence: 1, derivation: ['induction'] },
    tolerance: 0.01,
  },

  // Abduction
  {
    id: 'truth_abduction_1',
    category: 'truth_algebra',
    description: 'Abduction TRUE, TRUE',
    input: [
      { term: createInheritance('A', 'B'), truth: Truth.TRUE, stamp: createStamp(0) },
      { term: createInheritance('A', 'C'), truth: Truth.TRUE, stamp: createStamp(0) },
    ],
    ruleId: 'abduction',
    ruleCategory: 'abduction',
    expectedConclusion: createInheritance('B', 'C'),
    expectedTruth: { f: 1.0, c: 0.9 },
    expectedStamp: { evidence: 1, derivation: ['abduction'] },
    tolerance: 0.01,
  },

  // Revision
  {
    id: 'truth_revision_1',
    category: 'truth_algebra',
    description: 'Revision TRUE, TRUE',
    input: [
      { term: createInheritance('A', 'B'), truth: Truth.TRUE, stamp: createStamp(0, ['deduction']) },
      { term: createInheritance('A', 'B'), truth: Truth.TRUE, stamp: createStamp(0, ['induction']) },
    ],
    ruleId: 'revision',
    ruleCategory: 'revision',
    expectedConclusion: createInheritance('A', 'B'),
    expectedTruth: Truth.TRUE,
    expectedStamp: { evidence: 1, derivation: ['deduction', 'induction', 'revision'] },
  },
  {
    id: 'truth_revision_2',
    category: 'truth_algebra',
    description: 'Revision NEUTRAL, NEUTRAL',
    input: [
      { term: createInheritance('A', 'B'), truth: Truth.NEUTRAL, stamp: createStamp(0) },
      { term: createInheritance('A', 'B'), truth: Truth.NEUTRAL, stamp: createStamp(0) },
    ],
    ruleId: 'revision',
    ruleCategory: 'revision',
    expectedConclusion: createInheritance('A', 'B'),
    expectedTruth: { f: 0.5, c: 0.99 },
    expectedStamp: { evidence: 1, derivation: ['revision'] },
    tolerance: 0.01,
  },

  // Comparison/Analogy
  {
    id: 'truth_comparison_1',
    category: 'truth_algebra',
    description: 'Comparison TRUE, TRUE',
    input: [
      { term: createInheritance('A', 'B'), truth: Truth.TRUE, stamp: createStamp(0) },
      { term: createInheritance('C', 'D'), truth: Truth.TRUE, stamp: createStamp(0) },
    ],
    ruleId: 'comparison',
    ruleCategory: 'comparison',
    expectedConclusion: createInheritance('(A * C)', '(B * D)'),
    expectedTruth: Truth.TRUE,
    expectedStamp: { evidence: 1, derivation: ['comparison'] },
  },

  // ========================================================================
  // FULL DERIVATION VECTORS
  // ========================================================================

  // Socrates is mortal
  {
    id: 'derivation_socrates',
    category: 'full_derivation',
    description: 'Classic syllogism: Socrates -> Man, Man -> Mortal => Socrates -> Mortal',
    input: [
      { term: createInheritance('Socrates', 'Man'), truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
      { term: createInheritance('Man', 'Mortal'), truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
    ],
    ruleId: 'deduction',
    ruleCategory: 'deduction',
    expectedConclusion: createInheritance('Socrates', 'Mortal'),
    expectedTruth: { f: 1.0, c: 0.81 },
    expectedStamp: { evidence: 1, derivation: ['deduction'] },
    tolerance: 0.01,
  },

  // Bird/Tweety (default reasoning)
  {
    id: 'derivation_tweety',
    category: 'full_derivation',
    description: 'Default reasoning: Tweety -> Bird, Bird -> Fly => Tweety -> Fly (with revision)',
    input: [
      { term: createInheritance('Tweety', 'Bird'), truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
      { term: createInheritance('Bird', 'Fly'), truth: { f: 0.8, c: 0.8 }, stamp: createStamp(0) },
    ],
    ruleId: 'deduction',
    ruleCategory: 'deduction',
    expectedConclusion: createInheritance('Tweety', 'Fly'),
    expectedTruth: { f: 0.8, c: 0.64 },
    expectedStamp: { evidence: 1, derivation: ['deduction'] },
    tolerance: 0.01,
  },

  // Induction from examples
  {
    id: 'derivation_induction',
    category: 'full_derivation',
    description: 'Induction: Swan1 -> White, Swan2 -> White => Swan1 -> Swan2',
    input: [
      { term: createInheritance('Swan1', 'White'), truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
      { term: createInheritance('Swan2', 'White'), truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
    ],
    ruleId: 'induction',
    ruleCategory: 'induction',
    expectedConclusion: createInheritance('Swan1', 'Swan2'),
    expectedTruth: { f: 1.0, c: 0.9 },
    expectedStamp: { evidence: 1, derivation: ['induction'] },
    tolerance: 0.01,
  },

  // Abduction (diagnosis)
  {
    id: 'derivation_abduction',
    category: 'full_derivation',
    description: 'Abduction: WetGrass -> Rain, WetGrass -> Sprinkler => Rain -> Sprinkler',
    input: [
      { term: createInheritance('WetGrass', 'Rain'), truth: { f: 0.7, c: 0.8 }, stamp: createStamp(0) },
      { term: createInheritance('WetGrass', 'Sprinkler'), truth: { f: 0.6, c: 0.8 }, stamp: createStamp(0) },
    ],
    ruleId: 'abduction',
    ruleCategory: 'abduction',
    expectedConclusion: createInheritance('Rain', 'Sprinkler'),
    expectedTruth: { f: 0.7, c: 0.39 },
    expectedStamp: { evidence: 1, derivation: ['abduction'] },
    tolerance: 0.02,
  },

  // Revision chain
  {
    id: 'derivation_revision_chain',
    category: 'full_derivation',
    description: 'Multiple revisions of same belief',
    input: [
      { term: createInheritance('A', 'B'), truth: { f: 0.8, c: 0.7 }, stamp: createStamp(0, ['obs1']) },
      { term: createInheritance('A', 'B'), truth: { f: 0.7, c: 0.8 }, stamp: createStamp(0, ['obs2']) },
    ],
    ruleId: 'revision',
    ruleCategory: 'revision',
    expectedConclusion: createInheritance('A', 'B'),
    expectedTruth: { f: 0.75, c: 0.96 },
    expectedStamp: { evidence: 1, derivation: ['obs1', 'obs2', 'revision'] },
    tolerance: 0.02,
  },

  // Temporal prediction
  {
    id: 'derivation_temporal',
    category: 'full_derivation',
    description: 'Temporal: Cloudy -> Rain, Cloudy => Rain (prediction)',
    input: [
      { term: createInheritance('Cloudy', 'Rain'), truth: { f: 0.8, c: 0.7 }, stamp: createStamp(0) },
      { term: createInheritance('Now', 'Cloudy'), truth: { f: 1.0, c: 0.9 }, stamp: createStamp(0) },
    ],
    ruleId: 'temporal_deduction',
    ruleCategory: 'temporal',
    expectedConclusion: createInheritance('Now', 'Rain'),
    expectedTruth: { f: 0.8, c: 0.50 },
    expectedStamp: { evidence: 1, derivation: ['temporal_deduction'] },
    tolerance: 0.02,
  },
];

/** Helper to create a simple term. */
function createTerm(name: string): Term {
  return { op: TermOp.CONSTANT, value: name, hash: 0, complexity: 1 } as any;
}

function createInheritance(subject: string, predicate: string): Term {
  return { op: TermOp.INHERITANCE, args: [createTerm(subject), createTerm(predicate)], arity: 2, hash: 0, complexity: 2 } as any;
}

function createProduct(...terms: string[]): Term {
  return { op: TermOp.PRODUCT, args: terms.map(createTerm), arity: terms.length, hash: 0, complexity: terms.length } as any;
}

function createStamp(evidence: number, derivation: string[] = []): Stamp {
  return {
    id: `stamp-${evidence}-${derivation.join('-')}`,
    ts: Date.now(),
    parents: [],
    derivation,
    evidence,
  };
}

/** Get reference vectors by category. */
export function getVectorsByCategory(category: VectorCategory): ReferenceVector[] {
  return REFERENCE_VECTORS.filter(v => v.category === category);
}

/** Get reference vector by ID. */
export function getVectorById(id: string): ReferenceVector | undefined {
  return REFERENCE_VECTORS.find(v => v.id === id);
}

/** Run a reference vector against an engine. */
export interface VectorTestResult {
  vectorId: string;
  passed: boolean;
  actualTruth?: TruthValue;
  actualConclusion?: Term;
  diff?: number;
  error?: string;
}

export async function runReferenceVector(
  vector: ReferenceVector,
  engine: {
    step: (ruleId: RuleId, premises: Premise[]) => StepResult | null;
  }
): Promise<VectorTestResult> {
  const result = engine.step(vector.ruleId, vector.input);

  if (!result) {
    return { vectorId: vector.id, passed: false, error: 'Engine returned null' };
  }

  const truthDiff = Math.abs(result.truth.f - vector.expectedTruth.f) +
    Math.abs(result.truth.c - vector.expectedTruth.c);
  const tolerance = vector.tolerance ?? 1e-6;

  const truthMatch = truthDiff <= tolerance;
  const conclusionMatch = result.conclusion === vector.expectedConclusion;

  return {
    vectorId: vector.id,
    passed: truthMatch && conclusionMatch,
    actualTruth: result.truth,
    actualConclusion: result.conclusion,
    diff: truthDiff,
    error: (!truthMatch || !conclusionMatch)
      ? `Truth diff: ${truthDiff}, conclusion match: ${conclusionMatch}`
      : undefined,
  };
}

/** Run all reference vectors. */
export async function runAllReferenceVectors(
  engine: { step: (ruleId: RuleId, premises: Premise[]) => StepResult | null; },
  categories?: VectorCategory[]
): Promise<VectorTestResult[]> {
  const vectors = categories
    ? categories.flatMap(c => getVectorsByCategory(c))
    : REFERENCE_VECTORS;

  const results = await Promise.all(
    vectors.map(v => runReferenceVector(v, engine))
  );

  return results;
}

/** Reference vector suite summary. */
export interface VectorSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  byCategory: Record<VectorCategory, { total: number; passed: number; failed: number }>;
  maxDiff: number;
  avgDiff: number;
}

export function summarizeVectorResults(results: VectorTestResult[]): VectorSuiteSummary {
  const byCategory: VectorSuiteSummary['byCategory'] = {
    truth_algebra: { total: 0, passed: 0, failed: 0 },
    deduction: { total: 0, passed: 0, failed: 0 },
    induction: { total: 0, passed: 0, failed: 0 },
    abduction: { total: 0, passed: 0, failed: 0 },
    revision: { total: 0, passed: 0, failed: 0 },
    comparison: { total: 0, passed: 0, failed: 0 },
    analogy: { total: 0, passed: 0, failed: 0 },
    resemblance: { total: 0, passed: 0, failed: 0 },
    structural: { total: 0, passed: 0, failed: 0 },
    temporal: { total: 0, passed: 0, failed: 0 },
    gate: { total: 0, passed: 0, failed: 0 },
    budget: { total: 0, passed: 0, failed: 0 },
    full_derivation: { total: 0, passed: 0, failed: 0 },
    meta: { total: 0, passed: 0, failed: 0 },
  };

  let totalDiff = 0;
  let maxDiff = 0;

  for (const result of results) {
    const vector = getVectorById(result.vectorId);
    if (!vector) continue;

    const cat = vector.category;
    byCategory[cat].total++;
    if (result.passed) byCategory[cat].passed++;
    else byCategory[cat].failed++;

    if (result.diff !== undefined) {
      totalDiff += result.diff;
      maxDiff = Math.max(maxDiff, result.diff);
    }
  }

  return {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    byCategory,
    maxDiff,
    avgDiff: results.length > 0 ? totalDiff / results.length : 0,
  };
}

/** Generate reference vectors from a golden derivation corpus. */
export function generateVectorsFromCorpus(
  records: DerivationRecord[],
  maxPerCategory = 100
): ReferenceVector[] {
  const vectors: ReferenceVector[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    for (const step of record.steps) {
      const key = `${step.ruleId}|${step.premises.map(p => p.term).join('|')}`;
      if (seen.has(key)) continue;
      if (vectors.filter(v => v.ruleId === step.ruleId).length >= maxPerCategory) continue;

      seen.add(key);
      vectors.push({
        id: `corpus-${step.ruleId}-${vectors.length}`,
        category: step.ruleCategory,
        description: `Generated from corpus: ${record.id}`,
        input: step.premises,
        ruleId: step.ruleId,
        ruleCategory: step.ruleCategory,
        expectedConclusion: step.conclusion,
        expectedTruth: step.truth,
        expectedStamp: {
          evidence: step.stamp.evidence,
          derivation: [...step.stamp.derivation],
        },
      });
    }
  }

  return vectors;
}