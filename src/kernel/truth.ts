/**
 * Kernel Truth — the NAL truth algebra.
 *
 * Truth values are pairs (f, c) where:
 * - f = frequency [0,1]: proportion of positive evidence
 * - c = confidence [0,1]: amount of evidence relative to horizon
 *
 * All operations saturate at boundaries; no operation throws on valid input.
 */

import type { Frequency, Confidence, TruthLike, TruthValue } from './types.js';
import { clamp, clamp01, safeDiv } from '@senars/util/numeric';
import { softSquash } from './types.js';
import { weakenConfidence, confidenceToWeight, weightToConfidence } from '@senars/util/truth-algebra';

// Re-export TruthValue from types
export type { TruthValue } from './types.js';

// Import the utility functions we need
const MAX_CONFIDENCE = 0.999;
const WEAKENING_FACTOR = 10;
const CONFIRM_GAIN = 1.1;
const CONTRADICT_DECAY = 0.9;
const OUTCOME_GAIN = 0.1;

/** Truth value type. */
export type Truth = {
  readonly f: Frequency;
  readonly c: Confidence;
};

/** Normalize a truth value to valid domain. */
export const normalizeTruth = (f: number, c: number): Truth =>
  Object.freeze({
    f: clamp(isNaN(f) ? 0.5 : f, 0, 1) as Frequency,
    c: clamp(isNaN(c) ? 0.9 : c, 0, MAX_CONFIDENCE) as Confidence,
  });

/** Alias for normalizeTruth (test compatibility). */
export const normalize = normalizeTruth;

/** Create a truth value with validation. */
export const createTruth = (f: number, c: number): Truth => {
  if (c > MAX_CONFIDENCE) {
    throw new Error(`Confidence ${c} exceeds maximum ${MAX_CONFIDENCE}`);
  }
  return normalizeTruth(f, c);
};

/** Truth constants. */
export const Truth: {
  readonly TRUE: Truth;
  readonly FALSE: Truth;
  readonly NEUTRAL: Truth;
  readonly MAX_CONFIDENCE: number;
  readonly WEAKENING_FACTOR: number;
  readonly fromUnknown: (t: TruthLike | undefined, fallback?: Truth) => Truth;
  readonly normalize: (f: number, c: number) => Truth;
  readonly negation: (t: Truth) => Truth;
  readonly conversion: (t: Truth) => Truth;
  readonly attention: (t: Truth) => number;
  readonly expectation: (t: Truth) => number;
  readonly harshness: (t: Truth) => number;
  readonly analogy: (t1: Truth, t2: Truth) => Truth;
  readonly resemblance: (t1: Truth, t2: Truth) => Truth;
  readonly intersection: (t1: Truth, t2: Truth) => Truth;
  readonly union: (t1: Truth, t2: Truth) => Truth;
  readonly deduction: (t1: Truth, t2: Truth) => Truth;
  readonly deductionWeak: (t1: Truth, t2: Truth) => Truth | null;
  readonly induction: (t1: Truth, t2: Truth) => Truth;
  readonly abduction: (t1: Truth, t2: Truth) => Truth;
  readonly detachment: (t1: Truth, t2: Truth) => Truth;
  readonly revision: (t1: Truth, t2: Truth) => Truth;
  readonly revisionWeak: (t1: Truth, t2: Truth) => Truth;
  readonly choice: (t1: Truth, t2: Truth) => Truth;
  readonly structuralDeduction: (t: Truth) => Truth;
  readonly structuralReduction: (t: Truth) => Truth;
  readonly damp: (t: Truth, factor: number) => Truth;
  readonly reinforce: (t: Truth) => Truth;
  readonly contradict: (t: Truth) => Truth;
  readonly isStronger: (t1: Truth, t2: Truth) => boolean;
  readonly weak: (c: number) => number;
  readonly c2w: (c: number) => number;
  readonly w2c: (w: number) => number;
  readonly serialize: (t: Truth) => string;
  readonly format: (t: Truth, fractionDigits?: number) => string;
  readonly deserialize: (s: string) => Truth | null;
  readonly equals: (t1: Truth, t2: Truth, epsilon?: number) => boolean;
  readonly compare: (t1: Truth, t2: Truth) => number;
  readonly deductionChain: (t1: Truth, t2: Truth, steps: number) => Truth;
  readonly inductionChain: (t1: Truth, t2: Truth, steps: number, independence?: 'independent' | 'dependent' | 'unknown') => Truth;
  readonly abductionChain: (t1: Truth, t2: Truth, steps: number, independence?: 'independent' | 'dependent' | 'unknown') => Truth;
  readonly conversionChain: (t: Truth, steps: number) => Truth;
} = {
  TRUE: Object.freeze({ f: 1.0 as Frequency, c: 0.9 as Confidence }) as Truth,
  FALSE: Object.freeze({ f: 0.0 as Frequency, c: 0.9 as Confidence }) as Truth,
  NEUTRAL: Object.freeze({ f: 0.5 as Frequency, c: 0.9 as Confidence }) as Truth,
  MAX_CONFIDENCE,
  WEAKENING_FACTOR,

  /** Create from unknown input. */
  fromUnknown: (t: TruthLike | undefined, fallback: Truth = Truth.NEUTRAL): Truth => {
    if (!t) return fallback;
    return 'f' in t && 'c' in t ? (t as Truth) : normalizeTruth(t.frequency, t.confidence);
  },

  /** Normalize a truth value (clamp to valid domain). */
  normalize: normalizeTruth,

  /** Create a truth value with validation. Alias for createTruth (test compatibility). */
  create: createTruth,

  /** Negation: ~(f, c) = (1-f, c). */
  negation: (t: Truth): Truth => normalizeTruth(1 - t.f, t.c),

  /** Conversion: (f, c) -> (f, f*c). */
  conversion: (t: Truth): Truth => normalizeTruth(t.f, t.f * t.c),

  /** Attention/salience: f * c. Not a truth value, but a scalar for ranking. */
  attention: (t: Truth): number => t.f * t.c,

  /** Expectation: c * (f - 0.5) + 0.5. Signed confidence. */
  expectation: (t: Truth): number => t.c * (t.f - 0.5) + 0.5,

  /** Harshness: combination of expectation and confidence. */
  harshness: (t: Truth): number => {
    const exp = Truth.expectation(t);
    return (1 - t.c) * (1 - exp) + t.c * exp;
  },

  /** Comparison (analogy): (f1*f2, c1*c2). */
  analogy: (t1: Truth, t2: Truth): Truth => normalizeTruth(t1.f * t2.f, t1.c * t2.c),

  /** Resemblance: ((f1+f2)/2, c1*c2). */
  resemblance: (t1: Truth, t2: Truth): Truth => normalizeTruth((t1.f + t2.f) / 2, t1.c * t2.c),

  /** Intersection (conjunction): (f1*f2, c1*c2). */
  intersection: (t1: Truth, t2: Truth): Truth => normalizeTruth(t1.f * t2.f, t1.c * t2.c),

  /** Union (disjunction): (1-(1-f1)*(1-f2), c1*c2). */
  union: (t1: Truth, t2: Truth): Truth => normalizeTruth(1 - (1 - t1.f) * (1 - t2.f), t1.c * t2.c),

  /** Deduction (inheritance): (f1*f2, c1*c2). */
  deduction: (t1: Truth, t2: Truth): Truth => normalizeTruth(t1.f * t2.f, t1.c * t2.c),

  /** Deduction with weakening: c -> softSquash(c). */
  deductionWeak: (t1: Truth, t2: Truth): Truth | null => {
    const res = Truth.deduction(t1, t2);
    return createTruth(res.f, softSquash(res.c, WEAKENING_FACTOR));
  },

  /** Induction: (f2, softSquash(f2*c1*c2)). */
  induction: (t1: Truth, t2: Truth): Truth =>
    normalizeTruth(t2.f, softSquash(t2.f * t1.c * t2.c)),

  /** Abduction: (f1, softSquash(f1*c1*c2)). */
  abduction: (t1: Truth, t2: Truth): Truth =>
    normalizeTruth(t1.f, softSquash(t1.f * t1.c * t2.c)),

  /** Detachment: (f2, f1*c1*c2). */
  detachment: (t1: Truth, t2: Truth): Truth =>
    normalizeTruth(t2.f, t1.f * t1.c * t2.c),

  /** Revision (evidence merging): weighted by confidence. */
  revision: (t1: Truth, t2: Truth): Truth => {
    const w1 = confidenceToWeight(t1.c);
    const w2 = confidenceToWeight(t2.c);
    const w = w1 + w2;
    const newC = weightToConfidence(w);

    if (newC > MAX_CONFIDENCE) {
      return normalizeTruth((t1.f * t1.c + t2.f * t2.c) / (t1.c + t2.c), MAX_CONFIDENCE);
    }
    return normalizeTruth((t1.f * w1 + t2.f * w2) / w, newC);
  },

  /** Weak revision (for induction/abduction chains). */
  revisionWeak: (t1: Truth, t2: Truth): Truth => {
    const w1 = confidenceToWeight(t1.c) / WEAKENING_FACTOR;
    const w2 = confidenceToWeight(t2.c) / WEAKENING_FACTOR;
    const w = w1 + w2;
    return normalizeTruth((t1.f * w1 + t2.f * w2) / w, weightToConfidence(w));
  },

  /** Choice: select truth with higher expectation. */
  choice: (t1: Truth, t2: Truth): Truth =>
    Truth.expectation(t1) > Truth.expectation(t2) ? t1 : t2,

  /** Structural deduction: (f*f, softSquash(c)*c). */
  structuralDeduction: (t: Truth): Truth =>
    normalizeTruth(t.f * t.f, softSquash(t.c) * t.c),

  /** Structural reduction: (f, softSquash(c)). */
  structuralReduction: (t: Truth): Truth =>
    normalizeTruth(t.f, softSquash(t.c, WEAKENING_FACTOR)),

  /** Confidence decay. */
  damp: (t: Truth, factor: number): Truth =>
    normalizeTruth(t.f, t.c * factor),

  /** Reinforce from positive feedback. */
  reinforce: (t: Truth): Truth =>
    normalizeTruth(t.f * CONFIRM_GAIN, t.c + OUTCOME_GAIN),

  /** Contradict from negative feedback. */
  contradict: (t: Truth): Truth =>
    normalizeTruth(t.f * CONTRADICT_DECAY, t.c + OUTCOME_GAIN),

  /** Check if t1 is stronger than t2. */
  isStronger: (t1: Truth, t2: Truth): boolean =>
    Truth.expectation(t1) > Truth.expectation(t2),

  /** Weakening function: c / (c + WEAKENING_FACTOR). */
  weak: (c: number): number => weakenConfidence(c, WEAKENING_FACTOR),

  /** Confidence to weight. */
  c2w: confidenceToWeight,

  /** Weight to confidence. */
  w2c: weightToConfidence,

  /** Serialize to string. */
  serialize: (t: Truth): string => `%${t.f.toFixed(2)};${t.c.toFixed(2)}%`,

  /** Format for display. */
  format: (t: Truth, fractionDigits = 2): string =>
    `%${t.f.toFixed(fractionDigits)};${t.c.toFixed(fractionDigits)}%`,

  /** Deserialize from string. */
  deserialize: (s: string): Truth | null => {
    const match = /%([\d.]+);([\d.]+)%/.exec(s);
    if (!match) return null;
    return createTruth(parseFloat(match[1]!), parseFloat(match[2]!));
  },

  /** Equality with epsilon. */
  equals: (t1: Truth, t2: Truth, epsilon = 1e-3): boolean =>
    Math.abs(t1.f - t2.f) < epsilon && Math.abs(t1.c - t2.c) < epsilon,

  /** Compare by expectation. */
  compare: (t1: Truth, t2: Truth): number => {
    const diff = Truth.expectation(t1) - Truth.expectation(t2);
    return Math.abs(diff) < 1e-9 ? 0 : diff > 0 ? 1 : -1;
  },

  /** Deduction chain. */
  deductionChain: (t1: Truth, t2: Truth, steps: number): Truth => {
    let result = Truth.deduction(t1, t2);
    for (let i = 1; i < steps; i++) {
      result = Truth.deduction(result, t2);
    }
    return result;
  },

  /** Induction chain with revision. */
  inductionChain: (
    t1: Truth,
    t2: Truth,
    steps: number,
    independence: 'independent' | 'dependent' | 'unknown' = 'unknown'
  ): Truth => {
    let result = Truth.induction(t1, t2);
    for (let i = 1; i < steps; i++) {
      const contribution = Truth.induction(t1, t2);
      if (independence === 'unknown') {
        result = contribution;
      } else {
        result = Truth.revision(result, contribution);
      }
    }
    return result;
  },

  /** Abduction chain with revision. */
  abductionChain: (
    t1: Truth,
    t2: Truth,
    steps: number,
    independence: 'independent' | 'dependent' | 'unknown' = 'unknown'
  ): Truth => {
    let result = Truth.abduction(t1, t2);
    for (let i = 1; i < steps; i++) {
      const contribution = Truth.abduction(t1, t2);
      if (independence === 'unknown') {
        result = contribution;
      } else {
        result = Truth.revision(result, contribution);
      }
    }
    return result;
  },

  /** Conversion chain. */
  conversionChain: (t: Truth, steps: number): Truth => {
    let result = t;
    for (let i = 0; i < steps; i++) {
      result = Truth.conversion(result);
    }
    return result;
  },
} as const;

/** Type for truth operations. */
export type TruthOp =
  | 'negation'
  | 'conversion'
  | 'analogy'
  | 'resemblance'
  | 'intersection'
  | 'union'
  | 'deduction'
  | 'deductionWeak'
  | 'induction'
  | 'abduction'
  | 'detachment'
  | 'revision'
  | 'revisionWeak'
  | 'choice'
  | 'structuralDeduction'
  | 'structuralReduction'
  | 'damp'
  | 'reinforce'
  | 'contradict';

/** Get truth operation by name. */
export function getTruthOp(name: TruthOp): (t1: Truth, t2?: Truth, ...args: unknown[]) => Truth | null | number {
  const op = Truth[name];
  if (typeof op !== 'function') {
    throw new Error(`Unknown truth operation: ${name}`);
  }
  return op as (t1: Truth, t2?: Truth, ...args: unknown[]) => Truth | null | number;
}

/** Truth table for binary operations (for verification). */
export interface TruthTableEntry {
  op: TruthOp;
  t1: Truth;
  t2: Truth;
  result: Truth | null;
}

/** Generate truth table for an operation. */
export function generateTruthTable(op: TruthOp, steps = 5): TruthTableEntry[] {
  const entries: TruthTableEntry[] = [];
  const values = [
    Truth.TRUE,
    Truth.FALSE,
    Truth.NEUTRAL,
    { f: 0.8, c: 0.9 },
    { f: 0.2, c: 0.9 },
    { f: 0.5, c: 0.5 },
    { f: 0.9, c: 0.5 },
  ];

  for (const t1 of values) {
    for (const t2 of values) {
      let result: Truth | null = null;
      switch (op) {
        case 'analogy': result = Truth.analogy(t1, t2); break;
        case 'resemblance': result = Truth.resemblance(t1, t2); break;
        case 'intersection': result = Truth.intersection(t1, t2); break;
        case 'union': result = Truth.union(t1, t2); break;
        case 'deduction': result = Truth.deduction(t1, t2); break;
        case 'deductionWeak': result = Truth.deductionWeak(t1, t2); break;
        case 'induction': result = Truth.induction(t1, t2); break;
        case 'abduction': result = Truth.abduction(t1, t2); break;
        case 'detachment': result = Truth.detachment(t1, t2); break;
        case 'revision': result = Truth.revision(t1, t2); break;
        case 'revisionWeak': result = Truth.revisionWeak(t1, t2); break;
        case 'choice': result = Truth.choice(t1, t2); break;
      }
      entries.push({ op, t1, t2, result });
    }
  }

  return entries;
}

/** Verify truth algebra laws. */
export function verifyTruthLaws(): { law: string; holds: boolean; counterexample?: unknown }[] {
  const results: { law: string; holds: boolean; counterexample?: unknown }[] = [];

  // Commutativity of revision
  let holds = true;
  for (const t1 of [Truth.TRUE, Truth.FALSE, Truth.NEUTRAL, { f: 0.8, c: 0.9 }]) {
    for (const t2 of [Truth.TRUE, Truth.FALSE, Truth.NEUTRAL, { f: 0.3, c: 0.7 }]) {
      const r1 = Truth.revision(t1, t2);
      const r2 = Truth.revision(t2, t1);
      if (!Truth.equals(r1, r2)) {
        holds = false;
        results.push({ law: 'revision_commutativity', holds: false, counterexample: { t1, t2, r1, r2 } });
        break;
      }
    }
  }
  if (holds) results.push({ law: 'revision_commutativity', holds: true });

  // Associativity of revision
  holds = true;
  for (const t1 of [Truth.TRUE, Truth.FALSE, Truth.NEUTRAL, { f: 0.8, c: 0.9 }]) {
    for (const t2 of [Truth.TRUE, Truth.FALSE, Truth.NEUTRAL, { f: 0.3, c: 0.7 }]) {
      for (const t3 of [Truth.TRUE, Truth.FALSE, Truth.NEUTRAL, { f: 0.5, c: 0.5 }]) {
        const r1 = Truth.revision(Truth.revision(t1, t2), t3);
        const r2 = Truth.revision(t1, Truth.revision(t2, t3));
        if (!Truth.equals(r1, r2)) {
          holds = false;
          results.push({ law: 'revision_associativity', holds: false, counterexample: { t1, t2, t3, r1, r2 } });
          break;
        }
      }
    }
  }
  if (holds) results.push({ law: 'revision_associativity', holds: true });

  // Negation involution
  holds = true;
  for (const t of [Truth.TRUE, Truth.FALSE, Truth.NEUTRAL, { f: 0.8, c: 0.9 }, { f: 0.3, c: 0.7 }]) {
    const neg = Truth.negation(t);
    const negNeg = Truth.negation(neg);
    if (!Truth.equals(t, negNeg)) {
      holds = false;
      results.push({ law: 'negation_involution', holds: false, counterexample: { t, neg, negNeg } });
      break;
    }
  }
  if (holds) results.push({ law: 'negation_involution', holds: true });

  // Conversion idempotence at boundaries
  holds = true;
  for (const t of [Truth.TRUE, Truth.FALSE]) {
    const conv = Truth.conversion(t);
    const convConv = Truth.conversion(conv);
    if (!Truth.equals(conv, convConv)) {
      holds = false;
      results.push({ law: 'conversion_idempotence', holds: false, counterexample: { t, conv, convConv } });
      break;
    }
  }
  if (holds) results.push({ law: 'conversion_idempotence', holds: true });

  // Deduction preserves truth
  holds = true;
  const r = Truth.deduction(Truth.TRUE, Truth.TRUE);
  if (!Truth.equals(r, Truth.TRUE)) {
    holds = false;
    results.push({ law: 'deduction_preserves_true', holds: false, counterexample: { r } });
  }
  if (holds) results.push({ law: 'deduction_preserves_true', holds: true });

  return results;
}