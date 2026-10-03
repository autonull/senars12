import {
  confidenceToWeight,
  type Confidence,
  clamp,
  type Frequency,
  formatTruth,
  nearlyEqual,
  parseTruthLiteral,
  safeDiv,
  serializeTruth,
  softSquash,
  weightToConfidence,
  weakenConfidence,
} from '@senars/util';

export interface Truth {
  readonly f: Frequency;
  readonly c: Confidence;
}

const WEAKENING_FACTOR = 10;
const MAX_CONFIDENCE = 0.999;
/** Frequency multiplier on a confirmed feedback result. */
const CONFIRM_GAIN = 1.1;
/** Frequency multiplier on a contradicted feedback result. */
const CONTRADICT_DECAY = 0.9;
/** Confidence added by either outcome — how much a human or LM verdict is worth. */
const OUTCOME_GAIN = 0.1;

class TruthError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'TruthError';
  }
}

/**
 * Bring a value into the `Truth` domain: frequency in `0..1`, confidence in
 * `0..MAX_CONFIDENCE`, non-numeric input replaced by the unopinionated default
 * (`0.5`/`0.9`).
 *
 * Total by construction. This is what every rule op and every untrusted
 * boundary routes through, because the algebra saturates by design — a
 * confidence-weighted merge can exceed the cap, a saturating revision reaches
 * it — and a throw in the middle of a rule would abort a derivation over a
 * value the rule was always going to clamp.
 */
const normalizeTruth = (f: number, c: number): Truth =>
  Object.freeze({
    f: clamp(isNaN(f) ? 0.5 : f, 0, 1) as Frequency,
    c: clamp(isNaN(c) ? 0.9 : c, 0, MAX_CONFIDENCE) as Confidence,
  });

/**
 * The validating constructor: a confidence above the ceiling is a caller that
 * did not mean to produce it, not a value to be absorbed. Held separately from
 * {@link normalizeTruth} so that distinction survives — callers reading a
 * number off the wire, a schema, or a model reply use {@link Truth.normalize}.
 */
const createTruth = (f: number, c: number): Truth => {
  if (c > MAX_CONFIDENCE) {
    throw new TruthError(`Confidence ${c} exceeds maximum ${MAX_CONFIDENCE}`);
  }
  return normalizeTruth(f, c);
};

const c2w = confidenceToWeight;
const w2c = weightToConfidence;

const NEUTRAL_TRUTH: Truth = Object.freeze({
  f: 0.5 as Frequency,
  c: 0.9 as Confidence,
});

export type IndependenceStatus = 'independent' | 'dependent' | 'unknown';

const truthOps = {
  binary:
    <F extends (f1: number, f2: number, c1: number, c2: number) => [number, number]>(fn: F) =>
    (t1: Truth, t2: Truth): Truth => {
      const [f, c] = fn(t1.f, t2.f, t1.c, t2.c);
      return normalizeTruth(f, c);
    },
  unary:
    <F extends (f: number, c: number) => [number, number]>(fn: F) =>
    (t: Truth): Truth => {
      const [f, c] = fn(t.f, t.c);
      return normalizeTruth(f, c);
    },
  chain: (op: (t1: Truth, t2: Truth) => Truth, t1: Truth, t2: Truth, steps: number): Truth => {
    let result = op(t1, t2);
    for (let i = 1; i < steps; i++) result = op(result, t2);
    return result;
  },
  chainWithRevision: (
    op: (t1: Truth, t2: Truth) => Truth,
    t1: Truth,
    t2: Truth,
    steps: number,
    independence: IndependenceStatus = 'unknown'
  ): Truth => {
    let result = op(t1, t2);
    if (independence === 'unknown') return result;
    for (let i = 1; i < steps; i++) result = Truth.revision(result, op(t1, t2));
    return result;
  },
} as const;

export const Truth = {
  create: createTruth,
  normalize: normalizeTruth,
  fromUnknown: (
    t: { f: number; c: number } | { frequency: number; confidence: number } | undefined,
    fallback: Truth = NEUTRAL_TRUTH
  ): Truth => {
    if (!t) return fallback;
    return 'f' in t && 'c' in t ? (t as Truth) : normalizeTruth(t.frequency, t.confidence);
  },
  TRUE: Object.freeze({ f: 1.0 as Frequency, c: 0.9 as Confidence }) as Truth,
  FALSE: Object.freeze({ f: 0.0 as Frequency, c: 0.9 as Confidence }) as Truth,
  NEUTRAL: NEUTRAL_TRUTH,
  MAX_CONFIDENCE,
  negation: truthOps.unary((f, c) => [1 - f, c]),
  conversion: truthOps.unary((f, c) => [f, f * c]),

  /**
   * Salience: how much attention a truth earns, as `f · c`. This is the ordering
   * key for bags, budgets, and relevance gates — not a claim about how true
   * something is.
   *
   * It is deliberately not {@link Truth.expectation} and must never be read as
   * one. `expectation` is `c · (f - 0.5) + 0.5`, so it is signed around the
   * neutral midpoint and separates "I am certain it is false" from "I know
   * nothing"; `attention` collapses both, scoring `(f=0.50, c=0.80)` and
   * `(f=0.80, c=0.50)` identically. Ranking by it is right — a confidently-false
   * belief deserves attention too. Reporting it as confidence is wrong.
   */
  attention: (t: Truth): number => t.f * t.c,

  expectation: (t: Truth): number => t.c * (t.f - 0.5) + 0.5,
  harshness: (t: Truth): number => {
    const exp = Truth.expectation(t);
    return (1 - t.c) * (1 - exp) + t.c * exp;
  },

  comparison: truthOps.binary((f1, f2, c1, c2) => {
    const fProd = f1 * f2;
    return [safeDiv(fProd, fProd + (1 - f1) * (1 - f2)), c1 * c2];
  }),
  analogy: truthOps.binary((f1, f2, c1, c2) => [f1 * f2, c1 * c2 * f2]),
  resemblance: truthOps.binary((f1, f2, c1, c2) => [(f1 + f2) / 2, c1 * c2]),
  contraposition: truthOps.binary((f1, f2, c1, c2) => {
    const cf = f2 * (1 - f1);
    return [safeDiv(cf, cf + (1 - f2) * f1), c1 * c2];
  }),
  intersection: truthOps.binary((f1, f2, c1, c2) => [f1 * f2, c1 * c2]),
  union: truthOps.binary((f1, f2, c1, c2) => [1 - (1 - f1) * (1 - f2), c1 * c2]),
  subtract: truthOps.binary((f1, f2, c1, c2) => [Math.max(0, f1 - f2), c1 * c2]),
  diff: truthOps.binary((f1, f2, c1, c2) => [Math.abs(f1 - f2), c1 * c2]),
  exemplification: truthOps.binary((f1, f2, c1, c2) => [
    f1 * f2,
    softSquash(c1) * c1 * c2 * f1 * f2,
  ]),
  sameness: truthOps.binary((f1, f2, c1, c2) => [1 - Math.abs(f1 - f2), c1 * c2]),
  deduction: truthOps.binary((f1, f2, c1, c2) => [f1 * f2, c1 * c2]),
  deductionWeak: (t1: Truth, t2: Truth): Truth | null => {
    const res = Truth.deduction(t1, t2);
    return res ? createTruth(res.f, softSquash(res.c, WEAKENING_FACTOR)) : null;
  },
  induction: truthOps.binary((f1, f2, c1, c2) => [f2, softSquash(f2 * c1 * c2)]),
  abduction: truthOps.binary((f1, f2, c1, c2) => [f1, softSquash(f1 * c1 * c2)]),
  detachment: truthOps.binary((f1, f2, c1, c2) => [f2, f1 * c1 * c2]),
  revision: truthOps.binary((f1, f2, c1, c2) => {
    const w1 = c2w(c1),
      w2 = c2w(c2),
      w = w1 + w2;
    const newC = w2c(w);
    if (newC > MAX_CONFIDENCE) {
      return [(f1 * c1 + f2 * c2) / (c1 + c2), MAX_CONFIDENCE];
    }
    return [(f1 * w1 + f2 * w2) / w, newC];
  }),
  choice: (t1: Truth, t2: Truth): Truth =>
    Truth.expectation(t1) > Truth.expectation(t2) ? t1 : t2,
  structuralDeduction: truthOps.unary((f, c) => [f * f, softSquash(c) * c]),
  structuralReduction: truthOps.unary((f, c) => [f, softSquash(c, WEAKENING_FACTOR)]),
  revisionWeak: truthOps.binary((f1, f2, c1, c2) => {
    const w1 = c2w(c1) / WEAKENING_FACTOR,
      w2 = c2w(c2) / WEAKENING_FACTOR,
      w = w1 + w2;
    return [(f1 * w1 + f2 * w2) / w, w2c(w)];
  }),

  /**
   * Confidence decay by `factor`, frequency unchanged. Ageing a belief and
   * weakening a hypothetical both scale how much the evidence is worth while
   * leaving what it says alone.
   *
   * Distinct from {@link Truth.weak}, which is the NAL weakening rule
   * `c / (c + 10)` — a principled reduction, not a decay rate.
   */
  damp: (t: Truth, factor: number): Truth => truthOps.unary((f, c) => [f, c * factor])(t),

  /**
   * Outcome nudges from the feedback loop, not inference rules: a confirmed or
   * contradicted prediction shifts the belief and adds confidence, because a
   * checkable verdict is itself evidence.
   *
   * Heuristic by construction. A `c` already at the ceiling simply does not
   * move: `reinforce` and `contradict` land in {@link Truth.normalize}, so
   * `c + OUTCOME_GAIN` on a `0.9` belief saturates at
   * {@link Truth.MAX_CONFIDENCE} rather than escaping as `1.0` and failing the
   * domain check inside a feedback turn.
   */
  reinforce: truthOps.unary((f, c) => [f * CONFIRM_GAIN, c + OUTCOME_GAIN]),
  contradict: truthOps.unary((f, c) => [f * CONTRADICT_DECAY, c + OUTCOME_GAIN]),

  isStronger: (t1: Truth, t2: Truth): boolean => Truth.expectation(t1) > Truth.expectation(t2),
  weak: (c: number): number => weakenConfidence(c, WEAKENING_FACTOR),
  c2w,
  w2c,

  serialize: (t: Truth): string => serializeTruth(t),
  format: (t: Truth, fractionDigits = 2): string => formatTruth(t, fractionDigits),
  deserialize: (s: string): Truth | null => {
    const parsed = parseTruthLiteral(s);
    return parsed ? createTruth(parsed.f, parsed.c) : null;
  },
  equals: (t1: Truth, t2: Truth, epsilon = 1e-3): boolean => isTruthEqual(t1, t2, epsilon),
  compare: (t1: Truth, t2: Truth): number => {
    const diff = Truth.expectation(t1) - Truth.expectation(t2);
    return Math.abs(diff) < 1e-9 ? 0 : diff > 0 ? 1 : -1;
  },

  deductionChain: (t1: Truth, t2: Truth, steps: number): Truth =>
    truthOps.chain(Truth.deduction, t1, t2, steps),
  inductionChain: (
    t1: Truth,
    t2: Truth,
    steps: number,
    independence: IndependenceStatus = 'unknown'
  ): Truth => truthOps.chainWithRevision(Truth.induction, t1, t2, steps, independence),
  abductionChain: (
    t1: Truth,
    t2: Truth,
    steps: number,
    independence: IndependenceStatus = 'unknown'
  ): Truth => truthOps.chainWithRevision(Truth.abduction, t1, t2, steps, independence),
  conversionChain: (t: Truth, steps: number): Truth => {
    let result = t;
    for (let i = 0; i < steps; i++) result = Truth.conversion(result);
    return result;
  },
} as const;

/** The one epsilon-tolerant truth comparison; `Truth.equals` is the member form. */
export const isTruthEqual = (a: Truth, b: Truth, epsilon = 1e-3): boolean =>
  nearlyEqual(a.f, b.f, epsilon) && nearlyEqual(a.c, b.c, epsilon);
