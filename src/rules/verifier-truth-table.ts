/**
 * Verifier Truth Table — the transcribed NAL truth functions, kept independent
 * from the engine's arithmetic so drift is detectable (TODO28 §4.1).
 *
 * This table is *not* imported by the engine. The engine uses `Truth` directly;
 * the verifier uses this table. A test (`verifier-drift.test.ts`) compares them
 * and declares any further drift.
 *
 * IMPORTANT: These implementations are EXACT COPIES of the engine's Truth methods
 * (from src/terms/impls/Truth.ts) to ensure the only drift is the declared one:
 * revision:frequency (saturated revision branch).
 */

import type { Truth } from '../terms';
import { Truth as EngineTruth } from '../terms';

type TruthFn = (t1: Truth, t2?: Truth, ...args: unknown[]) => Truth | null | number;

// Constants copied from kernel Truth (src/kernel/truth.ts)
const WEAKENING_FACTOR = 10;
const MAX_CONFIDENCE = 0.999;
const CONFIRM_GAIN = 1.1;
const CONTRADICT_DECAY = 0.9;
const OUTCOME_GAIN = 0.1;

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
const clamp01 = (v: number): number => clamp(v, 0, 1);
const safeDiv = (num: number, den: number): number => (den === 0 ? 0 : num / den);
// Matches kernel/types.ts softSquash: c / (1 + c * factor) with default factor=10
const softSquash = (c: number, factor = 10): number => c / (1 + c * factor);

// Weight conversion (copied from Truth.ts)
const c2w = (c: number): number => {
  if (c >= 1) return Number.MAX_VALUE;
  return c / (1 - c);
};
const w2c = (w: number): number => {
  if (!Number.isFinite(w) || w >= Number.MAX_VALUE) return 1;
  return w / (1 + w);
};

const normalizeTruth = (f: number, c: number): Truth => ({
  f: clamp(isNaN(f) ? 0.5 : f, 0, 1) as Truth['f'],
  c: clamp(isNaN(c) ? 0.9 : c, 0, MAX_CONFIDENCE) as Truth['c'],
});

/** Binary truth functions as recorded by the verifier (exact copies from engine). */
export const BINARY_TRUTH: Readonly<Record<string, (f1: number, f2: number, c1: number, c2: number) => [number, number]>> = {
  comparison: (f1, f2, c1, c2) => {
    const fProd = f1 * f2;
    const [f, c] = [safeDiv(fProd, fProd + (1 - f1) * (1 - f2)), c1 * c2];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  analogy: (f1, f2, c1, c2) => {
    const [f, c] = [f1 * f2, c1 * c2];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  resemblance: (f1, f2, c1, c2) => {
    const [f, c] = [(f1 + f2) / 2, c1 * c2];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  contraposition: (f1, f2, c1, c2) => {
    const cf = f2 * (1 - f1);
    const [f, c] = [safeDiv(cf, cf + (1 - f2) * f1), c1 * c2];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  intersection: (f1, f2, c1, c2) => {
    const [f, c] = [f1 * f2, c1 * c2];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  union: (f1, f2, c1, c2) => {
    const [f, c] = [1 - (1 - f1) * (1 - f2), c1 * c2];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  subtract: (f1, f2, c1, c2) => {
    const [f, c] = [clamp01(f1 - f2), c1 * c2];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  diff: (f1, f2, c1, c2) => {
    const [f, c] = [Math.abs(f1 - f2), c1 * c2];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  exemplification: (f1, f2, c1, c2) => {
    const [f, c] = [f1 * f2, softSquash(c1) * c1 * c2 * f1 * f2];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  sameness: (f1, f2, c1, c2) => {
    const [f, c] = [1 - Math.abs(f1 - f2), c1 * c2];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  deduction: (f1, f2, c1, c2) => {
    const [f, c] = [f1 * f2, c1 * c2];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  induction: (f1, f2, c1, c2) => {
    const [f, c] = [f2, softSquash(f2 * c1 * c2)];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  abduction: (f1, f2, c1, c2) => {
    const [f, c] = [f1, softSquash(f1 * c1 * c2)];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  detachment: (f1, f2, c1, c2) => {
    const [f, c] = [f2, f1 * c1 * c2];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  revision: (f1, f2, c1, c2) => {
    const w1 = c2w(c1);
    const w2 = c2w(c2);
    const w = w1 + w2;
    const newC = w2c(w);
    // DECLARED DRIFT: The verifier always uses weight-based frequency,
    // even when confidence would exceed MAX_CONFIDENCE.
    // The engine switches to confidence-weighted frequency in that case.
    // This is the ONLY declared drift (revision:frequency).
    const clampedC = newC > MAX_CONFIDENCE ? MAX_CONFIDENCE : newC;
    const [f, c] = [(f1 * w1 + f2 * w2) / w, clampedC];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
  revisionWeak: (f1, f2, c1, c2) => {
    const w1 = c2w(c1) / WEAKENING_FACTOR;
    const w2 = c2w(c2) / WEAKENING_FACTOR;
    const w = w1 + w2;
    const [f, c] = [(f1 * w1 + f2 * w2) / w, w2c(w)];
    const n = normalizeTruth(f, c);
    return [n.f, n.c];
  },
};

/** Unary truth functions as recorded by the verifier (exact copies from engine). */
export const UNARY_TRUTH: Readonly<Record<string, (f: number, c: number) => [number, number]>> = {
  negation: (f, c) => {
    const [nf, nc] = [1 - f, c];
    const n = normalizeTruth(nf, nc);
    return [n.f, n.c];
  },
  conversion: (f, c) => {
    const [nf, nc] = [f, f * c];
    const n = normalizeTruth(nf, nc);
    return [n.f, n.c];
  },
  structuralDeduction: (f, c) => {
    const [nf, nc] = [f * f, softSquash(c) * c];
    const n = normalizeTruth(nf, nc);
    return [n.f, n.c];
  },
  structuralReduction: (f, c) => {
    const [nf, nc] = [f, softSquash(c, WEAKENING_FACTOR)];
    const n = normalizeTruth(nf, nc);
    return [n.f, n.c];
  },
  reinforce: (f, c) => {
    const [nf, nc] = [f * CONFIRM_GAIN, c + OUTCOME_GAIN];
    const n = normalizeTruth(nf, nc);
    return [n.f, n.c];
  },
  contradict: (f, c) => {
    const [nf, nc] = [f * CONTRADICT_DECAY, c + OUTCOME_GAIN];
    const n = normalizeTruth(nf, nc);
    return [n.f, n.c];
  },
};

/** The complete verifier truth table. */
export const VERIFIER_TRUTH_TABLE = {
  BINARY_TRUTH,
  UNARY_TRUTH,
} as const;

/**
 * Resolve a truth function name to the engine's implementation.
 * Returns null if the name is not recognized.
 */
export function resolveTruthFn(_ruleId: string, truthFnName: string): TruthFn | null {
  const fn = EngineTruth[truthFnName as keyof typeof EngineTruth];
  return typeof fn === 'function' ? (fn as TruthFn) : null;
}