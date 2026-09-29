import { z } from 'zod';
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

/**
 * The runtime guard for {@link BeliefTruth}, and the one place a truth value's
 * `0..1` bound is declared. The kernel's event payloads, its derivation
 * records, and the chat protocol all carry truth across an untrusted boundary;
 * three of them had spelled this object out inline, one of them without the
 * bound.
 */
export const BeliefTruthSchema = z.object({
  frequency: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

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

/**
 * Reads back what {@link formatNarseseTruth} writes. The suffix is a rendering,
 * not a grammar — the leading space is presentation and any number of decimals
 * parses — so a caller must not be stricter than the writer is.
 */
export function parseNarseseTruth(text: string): { f: number; c: number } | undefined {
  const match = text.match(/(?:^|\s):(\d*\.?\d+):(\d*\.?\d+)(?=\s|$)/);
  return match?.[1] && match[2] ? { f: Number(match[1]), c: Number(match[2]) } : undefined;
}

/** Narsese `%f;c%` truth literal. */
export function serializeTruth(truth: TruthLike, fractionDigits = 4): string {
  const { f, c } = 'f' in truth ? truth : { f: truth.frequency, c: truth.confidence };
  return `%${f.toFixed(fractionDigits)};${c.toFixed(fractionDigits)}%`;
}

/** Reads back what {@link serializeTruth} writes, tolerating the whitespace a term's punctuation leaves. */
export function parseTruthLiteral(text: string): { f: number; c: number } | undefined {
  const match = text.match(/%\s*(\d*\.?\d+)\s*;\s*(\d*\.?\d+)\s*%/);
  return match?.[1] && match[2] ? { f: Number(match[1]), c: Number(match[2]) } : undefined;
}

/** The single human/LLM-readable truth rendering — prompt text must not drift between call sites. */
export function formatTruth(truth: TruthLike, fractionDigits = 2): string {
  const { f, c } =
    'f' in truth ? truth : { f: truth.frequency, c: truth.confidence };
  return `(f=${f.toFixed(fractionDigits)}, c=${c.toFixed(fractionDigits)})`;
}
