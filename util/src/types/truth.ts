import { clamp01 } from '../utils/shared.js';

export type Frequency = number & { readonly __brand: unique symbol };
export type Confidence = number & { readonly __brand: unique symbol };

export function toFrequency(value: number): Frequency {
  return clamp01(value) as Frequency;
}

export function toConfidence(value: number): Confidence {
  return clamp01(value) as Confidence;
}

/** Either truth shape in the system: a `Truth` value (f/c) or a belief's truth (frequency/confidence). */
export type TruthLike = { f: number; c: number } | { frequency: number; confidence: number };

export type BeliefTruth = { frequency: number; confidence: number };

/** Belief-shaped truth from either truth representation; absent truth stays absent. */
export function asBeliefTruth(truth: TruthLike): BeliefTruth;
export function asBeliefTruth(truth: TruthLike | undefined): BeliefTruth | undefined;
export function asBeliefTruth(truth: TruthLike | undefined): BeliefTruth | undefined {
  if (!truth) return undefined;
  return 'f' in truth
    ? { frequency: truth.f, confidence: truth.c }
    : { frequency: truth.frequency, confidence: truth.confidence };
}

/**
 * Narsese inline truth suffix ` :f:c` (empty when absent) — the single
 * rendering for terms embedded in prompt text.
 */
export function formatNarseseTruth(truth: TruthLike | undefined, fractionDigits = 2): string {
  if (!truth) return '';
  const { f, c } = 'f' in truth ? truth : { f: truth.frequency, c: truth.confidence };
  return ` :${f.toFixed(fractionDigits)}:${c.toFixed(fractionDigits)}`;
}

/** Narsese `%f;c%` truth literal. */
export function serializeTruth(truth: TruthLike, fractionDigits = 4): string {
  const { f, c } = 'f' in truth ? truth : { f: truth.frequency, c: truth.confidence };
  return `%${f.toFixed(fractionDigits)};${c.toFixed(fractionDigits)}%`;
}

/** The single human/LLM-readable truth rendering — prompt text must not drift between call sites. */
export function formatTruth(truth: TruthLike, fractionDigits = 2): string {
  const { f, c } =
    'f' in truth ? truth : { f: truth.frequency, c: truth.confidence };
  return `(f=${f.toFixed(fractionDigits)}, c=${c.toFixed(fractionDigits)})`;
}
