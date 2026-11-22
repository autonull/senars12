import { z } from 'zod';
import { unitInterval } from '../config/boundary';
import { clamp, clamp01 } from '../util/numeric';
import {
  WEIGHT_AT_CERTAINTY,
  confidenceToWeight,
  weightToConfidence,
  weakenConfidence,
} from '../util/truth-algebra';
import { BeliefTruthSchema, TermTruthSchema } from '../util/truth-schema';

export type Frequency = number & { readonly __brand: unique symbol };
export type Confidence = number & { readonly __brand: unique symbol };

export function toFrequency(value: number): Frequency {
  return clamp01(value) as Frequency;
}

export function toConfidence(value: number): Confidence {
  return clamp01(value) as Confidence;
}

export type BeliefTruth = { frequency: number; confidence: number };

/** A `Truth` value in plain fields — the `{ f, c }` shape the engine speaks before
 *  `Truth` wraps it, and the half of {@link TruthLike} that has no declared name. */
export type TermTruth = { f: number; c: number };

/** Either truth shape in the system: a `Truth` value (f/c) or a belief's truth (frequency/confidence). */
export type TruthLike = TermTruth | BeliefTruth;

/**
 * The two projections between the system's two truth spellings, and the only
 * place either conversion is written.
 *
 * A truth value crosses a boundary as either `{ f, c }` or
 * `{ frequency, confidence }`, and every renderer, parser and adapter needs the
 * same narrow question answered: *what are the numbers?* Four renderers had each
 * spelled the narrowing out — `'f' in truth ? truth : { f: …, c: … }` — so a
 * fourth representation would have meant a fourth answer to a question the type
 * already closes.
 */
export function toTermTruth(truth: TruthLike): TermTruth {
  return 'f' in truth ? truth : { f: truth.frequency, c: truth.confidence };
}

/** Belief-shaped truth from either truth representation; absent truth stays absent. */
export function asBeliefTruth(truth: TruthLike): BeliefTruth;
export function asBeliefTruth(truth: TruthLike | undefined): BeliefTruth | undefined;
export function asBeliefTruth(truth: TruthLike | undefined): BeliefTruth | undefined {
  if (!truth) return undefined;
  const { f, c } = toTermTruth(truth);
  return { frequency: f, confidence: c };
}

/**
 * Narsese inline truth suffix ` :f:c` (empty when absent) — the single
 * rendering for terms embedded in prompt text.
 */
export function formatNarseseTruth(truth: TruthLike | undefined, fractionDigits = 2): string {
  if (!truth) return '';
  const { f, c } = toTermTruth(truth);
  return ` :${f.toFixed(fractionDigits)}:${c.toFixed(fractionDigits)}`;
}

/**
 * The two truth-suffix grammars, kept in one place because a caller that needs
 * to both read a suffix and know where it ended cannot do so with a parse
 * alone. Splitting them here rather than in a caller is what lets
 * {@link stripTruthSuffix} reuse exactly these patterns — a second copy of this
 * grammar is how `parseWithTruth` came to reject `%0.8; 0.9%`.
 */
const NARSESE_TRUTH = /(?:^|\s):(\d*\.?\d+):(\d*\.?\d+)(?=\s|$)/;
const TRUTH_LITERAL = /%\s*(\d*\.?\d+)\s*;\s*(\d*\.?\d+)\s*%/;

/**
 * The two capture groups every truth grammar yields, and where the match began.
 *
 * Both patterns are `(f)(c)`-shaped, so the read-back is one question about a
 * `RegExpMatchArray` and not four: the parsers want the numbers, and
 * {@link stripTruthSuffix} wants the numbers *and* the offset the match started
 * at. A pattern that failed to yield both groups is not a truth value, so it is
 * `undefined` rather than a partial one.
 */
type TruthMatch = { match: RegExpMatchArray; truth: TermTruth } | undefined;

const matchTruth = (pattern: RegExp, text: string): TruthMatch => {
  const match = pattern.exec(text);
  return match?.[1] && match[2]
    ? { match, truth: { f: Number(match[1]), c: Number(match[2]) } }
    : undefined;
};

/**
 * Reads back what {@link formatNarseseTruth} writes. The suffix is a rendering,
 * not a grammar — the leading space is presentation and any number of decimals
 * parses — so a caller must not be stricter than the writer is.
 */
export function parseNarseseTruth(text: string): TermTruth | undefined {
  return matchTruth(NARSESE_TRUTH, text)?.truth;
}

/** Narsese `%f;c%` truth literal. */
export function serializeTruth(truth: TruthLike, fractionDigits = 4): string {
  const { f, c } = toTermTruth(truth);
  return `%${f.toFixed(fractionDigits)};${c.toFixed(fractionDigits)}%`;
}

/** Reads back what {@link serializeTruth} writes, tolerating the whitespace a term's punctuation leaves. */
export function parseTruthLiteral(text: string): TermTruth | undefined {
  return matchTruth(TRUTH_LITERAL, text)?.truth;
}

/**
 * A Narsese sentence split into its term and the truth suffix it carries, if
 * any. The suffix is removed whole — including the whitespace inside a `%f; c%`
 * literal — so the body always parses on its own.
 */
export function stripTruthSuffix(text: string): {
  text: string;
  truth?: TermTruth;
} {
  const literal = matchTruth(TRUTH_LITERAL, text);
  if (literal) return { text: text.slice(0, literal.match.index).trim(), truth: literal.truth };
  const narsese = matchTruth(NARSESE_TRUTH, text);
  if (narsese) return { text: text.slice(0, narsese.match.index).trim(), truth: narsese.truth };
  return { text };
}

/** The single human/LLM-readable truth rendering — prompt text must not drift between call sites. */
export function formatTruth(truth: TruthLike, fractionDigits = 2): string {
  const { f, c } = toTermTruth(truth);
  return `(f=${f.toFixed(fractionDigits)}, c=${c.toFixed(fractionDigits)})`;
}
