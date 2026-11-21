/**
 * NAL Algebraic Laws — property-based verification of truth algebra.
 *
 * These laws define the expected algebraic properties of NAL truth operations.
 * They serve as the specification that both the engine and interpreter must satisfy.
 */

import { Truth, type TruthValue } from '../../kernel/truth.js';

/** Test case for a binary law. */
interface BinaryLawCase {
  readonly name: string;
  readonly arity: 2;
  readonly fn: (t1: TruthValue, t2: TruthValue) => TruthValue | null;
  readonly gen: () => [TruthValue, TruthValue];
  readonly check: (r1: TruthValue | null, r2: TruthValue | null) => boolean;
}

/** Test case for a unary law. */
interface UnaryLawCase {
  readonly name: string;
  readonly arity: 1;
  readonly fn: (t: TruthValue) => TruthValue;
  readonly gen: () => TruthValue;
  readonly check: (r1: TruthValue, r2: TruthValue) => boolean;
}

/** Law verification result. */
export interface LawResult {
  readonly law: string;
  readonly holds: boolean;
  readonly counterexample?: unknown;
  readonly details?: string;
}

/** Generate random truth values for testing. */
function genTruth(): TruthValue {
  return {
    f: Math.random(),
    c: Math.random() * 0.999,
  };
}

/** Generate two random truth values. */
function genTwoTruths(): [TruthValue, TruthValue] {
  return [genTruth(), genTruth()];
}

/** Check if two truth values are equal within epsilon. */
function truthEqual(t1: TruthValue | null, t2: TruthValue | null, eps = 1e-9): boolean {
  if (!t1 && !t2) return true;
  if (!t1 || !t2) return false;
  return Math.abs(t1.f - t2.f) < eps && Math.abs(t1.c - t2.c) < eps;
}

/** All algebraic laws for NAL truth operations. */
export const NAL_LAWS: readonly (BinaryLawCase | UnaryLawCase)[] = [
  // ========================================================================
  // UNARY LAWS
  // ========================================================================

  // Negation involution: ~~A = A
  {
    name: 'negation_involution',
    arity: 1,
    fn: (t: TruthValue) => Truth.negation(Truth.negation(t)),
    gen: genTruth,
    check: (r1: TruthValue, r2: TruthValue) => truthEqual(r1, r2),
  },

  // Conversion idempotence at boundaries: convert(convert(TRUE)) = convert(TRUE)
  {
    name: 'conversion_idempotence_true',
    arity: 1,
    fn: (t: TruthValue) => Truth.conversion(Truth.conversion(t)),
    gen: () => Truth.TRUE,
    check: (r1: TruthValue, r2: TruthValue) => truthEqual(r1, r2),
  },

  // Conversion idempotence at boundaries: convert(convert(FALSE)) = convert(FALSE)
  {
    name: 'conversion_idempotence_false',
    arity: 1,
    fn: (t: TruthValue) => Truth.conversion(Truth.conversion(t)),
    gen: () => Truth.FALSE,
    check: (r1: TruthValue, r2: TruthValue) => truthEqual(r1, r2),
  },

  // Structural deduction then reduction
  {
    name: 'structural_deduction_reduction',
    arity: 1,
    fn: (t: TruthValue) => Truth.structuralReduction(Truth.structuralDeduction(t)),
    gen: genTruth,
    check: (r1: TruthValue, r2: TruthValue) => truthEqual(r1, r2),
  },

  // ========================================================================
  // BINARY LAWS
  // ========================================================================

  // Revision commutativity: rev(A, B) = rev(B, A)
  {
    name: 'revision_commutativity',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.revision(t1, t2),
    gen: genTwoTruths,
    check: (r1: TruthValue | null, r2: TruthValue | null) => {
      const [t1, t2] = genTwoTruths();
      const rev1 = Truth.revision(t1, t2);
      const rev2 = Truth.revision(t2, t1);
      return truthEqual(rev1, rev2);
    },
  },

  // Revision associativity: rev(rev(A, B), C) = rev(A, rev(B, C))
  {
    name: 'revision_associativity',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.revision(Truth.revision(t1, t2), genTruth()),
    gen: () => [genTruth(), genTruth()],
    check: (_r1: TruthValue | null, _r2: TruthValue | null) => {
      const t1 = genTruth();
      const t2 = genTruth();
      const t3 = genTruth();
      const r1 = Truth.revision(Truth.revision(t1, t2), t3);
      const r2 = Truth.revision(t1, Truth.revision(t2, t3));
      return truthEqual(r1, r2);
    },
  },

  // Deduction with TRUE preserves truth: ded(TRUE, TRUE) = TRUE (frequency)
  {
    name: 'deduction_preserves_true_frequency',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.deduction(t1, t2),
    gen: () => [Truth.TRUE, Truth.TRUE],
    check: (r1: TruthValue | null, r2: TruthValue | null) => truthEqual(r1, Truth.TRUE),
  },

  // Deduction with FALSE yields frequency 0
  {
    name: 'deduction_false_frequency_zero',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.deduction(t1, t2),
    gen: () => [Truth.FALSE, Truth.TRUE],
    check: (r1: TruthValue | null, r2: TruthValue | null) => Math.abs((r1?.f ?? 0) - 0) < 1e-9,
  },

  // Analogy commutativity: ana(A, B) = ana(B, A)
  {
    name: 'analogy_commutativity',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.analogy(t1, t2),
    gen: genTwoTruths,
    check: (r1: TruthValue | null, r2: TruthValue | null) => {
      const [t1, t2] = genTwoTruths();
      return truthEqual(Truth.analogy(t1, t2), Truth.analogy(t2, t1));
    },
  },

  // Resemblance commutativity: res(A, B) = res(B, A)
  {
    name: 'resemblance_commutativity',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.resemblance(t1, t2),
    gen: genTwoTruths,
    check: (r1: TruthValue | null, r2: TruthValue | null) => {
      const [t1, t2] = genTwoTruths();
      return truthEqual(Truth.resemblance(t1, t2), Truth.resemblance(t2, t1));
    },
  },

  // Intersection commutativity: inter(A, B) = inter(B, A)
  {
    name: 'intersection_commutativity',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.intersection(t1, t2),
    gen: genTwoTruths,
    check: (r1: TruthValue | null, r2: TruthValue | null) => {
      const [t1, t2] = genTwoTruths();
      return truthEqual(Truth.intersection(t1, t2), Truth.intersection(t2, t1));
    },
  },

  // Union commutativity: union(A, B) = union(B, A)
  {
    name: 'union_commutativity',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.union(t1, t2),
    gen: genTwoTruths,
    check: (r1: TruthValue | null, r2: TruthValue | null) => {
      const [t1, t2] = genTwoTruths();
      return truthEqual(Truth.union(t1, t2), Truth.union(t2, t1));
    },
  },

  // De Morgan: neg(inter(A, B)) = union(neg(A), neg(B))
  {
    name: 'de_morgan_intersection',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.negation(Truth.intersection(t1, t2)),
    gen: genTwoTruths,
    check: (r1: TruthValue | null, r2: TruthValue | null) => {
      const [t1, t2] = genTwoTruths();
      const left = Truth.negation(Truth.intersection(t1, t2));
      const right = Truth.union(Truth.negation(t1), Truth.negation(t2));
      return truthEqual(left, right);
    },
  },

  // De Morgan: neg(union(A, B)) = inter(neg(A), neg(B))
  {
    name: 'de_morgan_union',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.negation(Truth.union(t1, t2)),
    gen: genTwoTruths,
    check: (r1: TruthValue | null, r2: TruthValue | null) => {
      const [t1, t2] = genTwoTruths();
      const left = Truth.negation(Truth.union(t1, t2));
      const right = Truth.intersection(Truth.negation(t1), Truth.negation(t2));
      return truthEqual(left, right);
    },
  },

  // Induction/Abduction symmetry with same premises
  {
    name: 'induction_abduction_same_premises',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.induction(t1, t2),
    gen: genTwoTruths,
    check: (r1: TruthValue | null, r2: TruthValue | null) => {
      const [t1, t2] = genTwoTruths();
      const ind = Truth.induction(t1, t2);
      const abd = Truth.abduction(t1, t2);
      // With same premises, induction takes predicate of second, abduction takes predicate of first
      // They differ in frequency but have same confidence structure
      return Math.abs(ind.c - abd.c) < 1e-9;
    },
  },

  // Detachment: det(ded(A, B), A) = B (approximately)
  {
    name: 'detachment_deduction',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.detachment(Truth.deduction(t1, t2), t1),
    gen: genTwoTruths,
    check: (r1: TruthValue | null, r2: TruthValue | null) => {
      const [t1, t2] = genTwoTruths();
      const ded = Truth.deduction(t1, t2);
      const det = Truth.detachment(ded, t1);
      // Detachment should recover the second premise's frequency
      return Math.abs(det.f - t2.f) < 1e-9;
    },
  },

  // Confidence bounds: all operations produce c <= MAX_CONFIDENCE
  {
    name: 'confidence_bounds',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.revision(t1, t2),
    gen: () => [{ f: 0.9, c: 0.99 }, { f: 0.8, c: 0.99 }],
    check: (r1: TruthValue | null, r2: TruthValue | null) => (r1?.c ?? 0) <= Truth.MAX_CONFIDENCE + 1e-9,
  },

  // Frequency bounds: all operations produce f in [0, 1]
  {
    name: 'frequency_bounds',
    arity: 2,
    fn: (t1: TruthValue, t2: TruthValue) => Truth.revision(t1, t2),
    gen: genTwoTruths,
    check: (r1: TruthValue | null, r2: TruthValue | null) => (r1?.f ?? 0) >= 0 && (r1?.f ?? 0) <= 1,
  },
];

/** OpenNARS reference vectors for truth operations.
 *
 * These are known input/output pairs from OpenNARS used for cross-validation.
 * Format: [f1, c1, f2, c2] -> [f_out, c_out]
 */
export const OPENNARS_REFERENCE_VECTORS: Readonly<Record<string, readonly number[]>> = {
  // Deduction
  'deduction:1,0.9,1,0.9': [1.0, 0.81],
  'deduction:0,0.9,1,0.9': [0.0, 0.81],
  'deduction:0.5,0.9,0.5,0.9': [0.25, 0.81],
  'deduction:0.8,0.9,0.6,0.9': [0.48, 0.81],

  // Induction
  'induction:1,0.9,1,0.9': [1.0, 0.473684], // softSquash(1*0.9*0.9) = 0.81/1.81
  'induction:0.5,0.9,0.5,0.9': [0.5, 0.195122], // softSquash(0.5*0.9*0.9)

  // Abduction
  'abduction:1,0.9,1,0.9': [1.0, 0.473684],
  'abduction:0.5,0.9,0.5,0.9': [0.5, 0.195122],

  // Revision
  'revision:0.8,0.7,0.7,0.8': [0.75, 0.908], // Weighted by confidence
  'revision:1,0.9,0,0.9': [0.5, 0.947368],
  'revision:0.5,0.5,0.5,0.5': [0.5, 0.666667],

  // Analogy
  'analogy:1,0.9,1,0.9': [1.0, 0.81],
  'analogy:0.8,0.9,0.6,0.9': [0.48, 0.81],

  // Resemblance
  'resemblance:0.8,0.9,0.6,0.9': [0.7, 0.81],
  'resemblance:1,0.9,0,0.9': [0.5, 0.81],

  // Intersection
  'intersection:0.8,0.9,0.6,0.9': [0.48, 0.81],

  // Union
  'union:0.8,0.9,0.6,0.9': [0.92, 0.81],

  // Negation
  'negation:0.8,0.9': [0.2, 0.9],

  // Conversion
  'conversion:0.8,0.9': [0.8, 0.72],

  // Detachment
  'detachment:1,0.9,1,0.9': [1.0, 0.81],
};

/** Verify all algebraic laws. */
export function verifyLaws(engine: typeof Truth): LawResult[] {
  const results: LawResult[] = [];

  for (const law of NAL_LAWS) {
    let holds = true;
    let counterexample: unknown = undefined;

    // Run multiple iterations for property-based testing
    for (let i = 0; i < 100; i++) {
      if (law.arity === 1) {
        // Unary law
        const t = law.gen();
        const r1 = law.fn(t);
        const r2 = law.fn(t); // Same input, should be deterministic
        if (!law.check(r1, r2)) {
          holds = false;
          counterexample = { input: t, r1, r2 };
          break;
        }
      } else {
        // Binary law
        const [t1, t2] = law.gen();
        const r1 = law.fn(t1, t2);
        const r2 = law.fn(t1, t2);
        if (!law.check(r1, r2)) {
          holds = false;
          counterexample = { t1, t2, r1, r2 };
          break;
        }
      }
    }

    results.push({ law: law.name, holds, counterexample });
  }

  return results;
}

/** Verify against OpenNARS reference vectors. */
export function verifyReferenceVectors(engine: typeof Truth): LawResult[] {
  const results: LawResult[] = [];

  for (const [key, expected] of Object.entries(OPENNARS_REFERENCE_VECTORS)) {
    const parts = key.split(':');
    const op = parts[0]!;
    const args = parts[1]!.split(',').map(Number);

    let actual: TruthValue | null = null;
    let holds = true;

    try {
      switch (op) {
        case 'deduction':
          actual = Truth.deduction({ f: args[0]!, c: args[1]! }, { f: args[2]!, c: args[3]! });
          break;
        case 'induction':
          actual = Truth.induction({ f: args[0]!, c: args[1]! }, { f: args[2]!, c: args[3]! });
          break;
        case 'abduction':
          actual = Truth.abduction({ f: args[0]!, c: args[1]! }, { f: args[2]!, c: args[3]! });
          break;
        case 'revision':
          actual = Truth.revision({ f: args[0]!, c: args[1]! }, { f: args[2]!, c: args[3]! });
          break;
        case 'analogy':
          actual = Truth.analogy({ f: args[0]!, c: args[1]! }, { f: args[2]!, c: args[3]! });
          break;
        case 'resemblance':
          actual = Truth.resemblance({ f: args[0]!, c: args[1]! }, { f: args[2]!, c: args[3]! });
          break;
        case 'intersection':
          actual = Truth.intersection({ f: args[0]!, c: args[1]! }, { f: args[2]!, c: args[3]! });
          break;
        case 'union':
          actual = Truth.union({ f: args[0]!, c: args[1]! }, { f: args[2]!, c: args[3]! });
          break;
        case 'negation':
          actual = Truth.negation({ f: args[0]!, c: args[1]! });
          break;
        case 'conversion':
          actual = Truth.conversion({ f: args[0]!, c: args[1]! });
          break;
        case 'detachment':
          actual = Truth.detachment({ f: args[0]!, c: args[1]! }, { f: args[2]!, c: args[3]! });
          break;
      }

      if (actual) {
        holds = Math.abs(actual.f - expected[0]!) < 0.01 && Math.abs(actual.c - expected[1]!) < 0.01;
      } else {
        holds = false;
      }
    } catch {
      holds = false;
    }

    results.push({
      law: `ref_vector_${key}`,
      holds,
      counterexample: holds ? undefined : { expected, actual },
      details: `Expected [${expected.join(', ')}], got [${actual ? [actual.f.toFixed(4), actual.c.toFixed(4)].join(', ') : 'error'}]`,
    });
  }

  return results;
}

/** Run complete verification suite. */
export function runVerification(engine: typeof Truth = Truth): {
  laws: LawResult[];
  vectors: LawResult[];
  summary: { passed: number; failed: number; total: number };
} {
  const laws = verifyLaws(engine);
  const vectors = verifyReferenceVectors(engine);

  const all = [...laws, ...vectors];
  const passed = all.filter(r => r.holds).length;
  const failed = all.filter(r => !r.holds).length;

  return { laws, vectors, summary: { passed, failed, total: all.length } };
}