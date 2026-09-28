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

/** The single human/LLM-readable truth rendering — prompt text must not drift between call sites. */
export function formatTruth(truth: TruthLike, fractionDigits = 2): string {
  const { f, c } =
    'f' in truth ? truth : { f: truth.frequency, c: truth.confidence };
  return `(f=${f.toFixed(fractionDigits)}, c=${c.toFixed(fractionDigits)})`;
}
