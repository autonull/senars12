/**
 * Fuzzy Logic Port — conformance layer for fuzzy truth values.
 *
 * Provides a fuzzy logic implementation that conforms to the
 * kernel truth port interface, enabling gradual reasoning.
 */

import { Frequency, Confidence, TruthValue, TruthLike } from '../kernel/types.js';

/** Fuzzy truth value extends standard truth with membership degree. */
export interface FuzzyTruth extends TruthValue {
  /** Membership degree [0,1]. */
  readonly membership: number;
  /** Uncertainty/non-specificity [0,1]. */
  readonly uncertainty: number;
}

/** Fuzzy set membership function. */
export type MembershipFunction = (x: number) => number;

/** Fuzzy logic configuration. */
export interface FuzzyConfig {
  /** Default t-norm for conjunction. */
  tNorm: 'min' | 'product' | 'lukasiewicz';
  /** Default t-conorm for disjunction. */
  tConorm: 'max' | 'probabilistic' | 'lukasiewicz';
  /** Implication method. */
  implication: 'standard' | 'lukasiewicz' | 'godel' | 'goguen';
}

/** Default configuration. */
export const defaultFuzzyConfig: FuzzyConfig = {
  tNorm: 'min',
  tConorm: 'max',
  implication: 'standard',
};

/** Fuzzy truth constants. */
export const FuzzyTruth = {
  /** Full membership, no uncertainty. */
  TRUE: { f: 1.0, c: 1.0, membership: 1.0, uncertainty: 0.0 } as FuzzyTruth,
  /** No membership, no uncertainty. */
  FALSE: { f: 0.0, c: 1.0, membership: 0.0, uncertainty: 0.0 } as FuzzyTruth,
  /** Unknown membership, maximum uncertainty. */
  UNKNOWN: { f: 0.5, c: 0.0, membership: 0.5, uncertainty: 1.0 } as FuzzyTruth,
};

/** Create fuzzy truth value. */
export function createFuzzyTruth(membership: number, uncertainty: number): FuzzyTruth {
  const m = Math.max(0, Math.min(1, membership));
  const u = Math.max(0, Math.min(1, uncertainty));
  return {
    f: m,
    c: 1 - u,
    membership: m,
    uncertainty: u,
  };
}

/** Create from standard truth value. */
export function fromTruth(truth: TruthValue): FuzzyTruth {
  return {
    f: truth.f,
    c: truth.c,
    membership: truth.f,
    uncertainty: 1 - truth.c,
  };
}

/** Convert to standard truth value. */
export function toTruth(fuzzy: FuzzyTruth): TruthValue {
  return { f: fuzzy.f, c: fuzzy.c };
}

/** T-norms (conjunction). */
export const TNorm = {
  min: (a: number, b: number) => Math.min(a, b),
  product: (a: number, b: number) => a * b,
  lukasiewicz: (a: number, b: number) => Math.max(0, a + b - 1),
};

/** T-conorms (disjunction). */
export const TConorm = {
  max: (a: number, b: number) => Math.max(a, b),
  probabilistic: (a: number, b: number) => a + b - a * b,
  lukasiewicz: (a: number, b: number) => Math.min(1, a + b),
};

/** Fuzzy negation. */
export function fuzzyNegation(a: FuzzyTruth): FuzzyTruth {
  return createFuzzyTruth(1 - a.membership, a.uncertainty);
}

/** Fuzzy conjunction (t-norm). */
export function fuzzyConjunction(a: FuzzyTruth, b: FuzzyTruth, tNorm: keyof typeof TNorm = 'min'): FuzzyTruth {
  const membership = TNorm[tNorm](a.membership, b.membership);
  const uncertainty = Math.max(a.uncertainty, b.uncertainty); // Conservative
  return createFuzzyTruth(membership, uncertainty);
}

/** Fuzzy disjunction (t-conorm). */
export function fuzzyDisjunction(a: FuzzyTruth, b: FuzzyTruth, tConorm: keyof typeof TConorm = 'max'): FuzzyTruth {
  const membership = TConorm[tConorm](a.membership, b.membership);
  const uncertainty = Math.max(a.uncertainty, b.uncertainty);
  return createFuzzyTruth(membership, uncertainty);
}

/** Fuzzy implication. */
export function fuzzyImplication(a: FuzzyTruth, b: FuzzyTruth, method: 'standard' | 'lukasiewicz' | 'godel' | 'goguen' = 'standard'): FuzzyTruth {
  let membership: number;

  switch (method) {
    case 'standard':
      // Standard implication: ~a | b
      membership = Math.max(1 - a.membership, b.membership);
      break;
    case 'lukasiewicz':
      // Lukasiewicz: min(1, 1 - a + b)
      membership = Math.min(1, 1 - a.membership + b.membership);
      break;
    case 'godel':
      // Gödel: a <= b ? 1 : b
      membership = a.membership <= b.membership ? 1 : b.membership;
      break;
    case 'goguen':
      // Goguen: a == 0 ? 1 : min(1, b / a)
      membership = a.membership === 0 ? 1 : Math.min(1, b.membership / a.membership);
      break;
  }

  const uncertainty = Math.max(a.uncertainty, b.uncertainty);
  return createFuzzyTruth(membership, uncertainty);
}

/** Fuzzy equivalence. */
export function fuzzyEquivalence(a: FuzzyTruth, b: FuzzyTruth): FuzzyTruth {
  const membership = 1 - Math.abs(a.membership - b.membership);
  const uncertainty = Math.max(a.uncertainty, b.uncertainty);
  return createFuzzyTruth(membership, uncertainty);
}

/** Fuzzy hedge (modifier). */
export type Hedge = 'very' | 'somewhat' | 'more_or_less' | 'extremely';

export function applyHedge(truth: FuzzyTruth, hedge: Hedge): FuzzyTruth {
  const power = hedgePowers[hedge] ?? 1;
  const membership = Math.pow(truth.membership, power);
  return createFuzzyTruth(membership, truth.uncertainty);
}

const hedgePowers: Record<Hedge, number> = {
  very: 2,
  somewhat: 0.5,
  more_or_less: 0.7,
  extremely: 3,
};

/** Fuzzy quantifiers. */
export interface FuzzyQuantifier {
  readonly name: string;
  readonly evaluate: (proportion: number) => number;
}

export const FuzzyQuantifiers: Record<string, FuzzyQuantifier> = {
  most: { name: 'most', evaluate: p => p > 0.5 ? 2 * p - 1 : 0 },
  many: { name: 'many', evaluate: p => p > 0.3 ? (p - 0.3) / 0.7 : 0 },
  few: { name: 'few', evaluate: p => p < 0.3 ? 1 - p / 0.3 : 0 },
  some: { name: 'some', evaluate: p => p > 0 ? 1 : 0 },
  all: { name: 'all', evaluate: p => p === 1 ? 1 : 0 },
};

/** Evaluate fuzzy quantified statement. */
export function evaluateQuantified(quantifier: FuzzyQuantifier, truths: readonly FuzzyTruth[]): FuzzyTruth {
  if (truths.length === 0) return FuzzyTruth.UNKNOWN;

  const satisfied = truths.filter(t => t.membership > 0.5).length;
  const proportion = satisfied / truths.length;
  const membership = quantifier.evaluate(proportion);

  return createFuzzyTruth(membership, 1 - proportion);
}

/** Fuzzy rule: IF antecedent THEN consequent. */
export interface FuzzyRule {
  readonly antecedent: FuzzyTruth;
  readonly consequent: FuzzyTruth;
  readonly weight: number;
}

/** Fuzzy inference (Mamdani-style). */
export function fuzzyInference(rules: readonly FuzzyRule[], input: FuzzyTruth): FuzzyTruth {
  if (rules.length === 0) return FuzzyTruth.UNKNOWN;

  // Fire all rules
  const fired = rules.map(rule => {
    const strength = TNorm.min(rule.antecedent.membership, input.membership);
    return createFuzzyTruth(
      TNorm.min(strength, rule.consequent.membership),
      Math.max(rule.antecedent.uncertainty, rule.consequent.uncertainty)
    );
  });

  // Aggregate (max)
  let result = fired[0]!;
  for (let i = 1; i < fired.length; i++) {
    result = fuzzyDisjunction(result, fired[i]!);
  }

  return result;
}

/** Port conformance test. */
export function testPortConformance(): { passed: boolean; results: Record<string, boolean> } {
  const results: Record<string, boolean> = {};

  // Test 1: Negation involution
  const t1 = createFuzzyTruth(0.7, 0.2);
  const neg1 = fuzzyNegation(t1);
  const neg2 = fuzzyNegation(neg1);
  results.negation_involution = Math.abs(neg2.membership - t1.membership) < 1e-10;

  // Test 2: Conjunction commutativity
  const t2a = createFuzzyTruth(0.6, 0.1);
  const t2b = createFuzzyTruth(0.8, 0.3);
  const conj1 = fuzzyConjunction(t2a, t2b);
  const conj2 = fuzzyConjunction(t2b, t2a);
  results.conjunction_commutativity = Math.abs(conj1.membership - conj2.membership) < 1e-10;

  // Test 3: Disjunction commutativity
  const disj1 = fuzzyDisjunction(t2a, t2b);
  const disj2 = fuzzyDisjunction(t2b, t2a);
  results.disjunction_commutativity = Math.abs(disj1.membership - disj2.membership) < 1e-10;

  // Test 4: De Morgan laws
  const dm1 = fuzzyNegation(fuzzyConjunction(t2a, t2b));
  const dm2 = fuzzyDisjunction(fuzzyNegation(t2a), fuzzyNegation(t2b));
  results.de_morgan = Math.abs(dm1.membership - dm2.membership) < 1e-10;

  // Test 5: Implication boundary conditions
  const impTT = fuzzyImplication(FuzzyTruth.TRUE, FuzzyTruth.TRUE);
  const impFF = fuzzyImplication(FuzzyTruth.FALSE, FuzzyTruth.FALSE);
  const impTF = fuzzyImplication(FuzzyTruth.TRUE, FuzzyTruth.FALSE);
  results.implication_boundaries = impTT.membership === 1 && impFF.membership === 1 && impTF.membership === 0;

  const passed = Object.values(results).every(v => v);
  return { passed, results };
}

/** Create fuzzy truth from truth-like input. */
export function fuzzyFromUnknown(input: TruthLike | FuzzyTruth | undefined, fallback?: FuzzyTruth): FuzzyTruth {
  if (!input) return fallback ?? FuzzyTruth.UNKNOWN;
  if ('membership' in input && 'uncertainty' in input) return input as FuzzyTruth;
  return fromTruth({ f: (input as TruthLike).frequency, c: (input as TruthLike).confidence });
}

/** Format fuzzy truth for display. */
export function formatFuzzyTruth(truth: FuzzyTruth): string {
  return `μ=${truth.membership.toFixed(3)} υ=${truth.uncertainty.toFixed(3)}`;
}

/** Parse fuzzy truth from string. */
export function parseFuzzyTruth(s: string): FuzzyTruth | null {
  const match = /μ=([\d.]+)\s*υ=([\d.]+)/.exec(s);
  if (!match) return null;
  return createFuzzyTruth(parseFloat(match[1]!), parseFloat(match[2]!));
}

/** Fuzzy Logic implementation of the Logic port. */
export const FUZZY_LOGIC: import('../port.js').Logic<FuzzyTruth> = {
  id: 'fuzzy',
  version: '1.0.0',
  codec: {
    encode: (t: FuzzyTruth) => formatFuzzyTruth(t),
    decode: (s: string) => parseFuzzyTruth(s),
  },
  expect: (t: FuzzyTruth) => t.membership,
  conf: (t: FuzzyTruth) => 1 - t.uncertainty,
  contradicts: (a: FuzzyTruth, b: FuzzyTruth) => {
    // Contradiction if membership values are far apart with low uncertainty
    return Math.abs(a.membership - b.membership) > 0.5 && a.uncertainty < 0.3 && b.uncertainty < 0.3;
  },
  policy: 'coexist',
  rules: [], // Fuzzy logic uses function-based rules, not formula-ASTs
} as const;