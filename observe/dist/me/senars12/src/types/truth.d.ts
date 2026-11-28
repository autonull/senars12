export type Frequency = number & {
    readonly __brand: unique symbol;
};
export type Confidence = number & {
    readonly __brand: unique symbol;
};
export declare function toFrequency(value: number): Frequency;
export declare function toConfidence(value: number): Confidence;
export type BeliefTruth = {
    frequency: number;
    confidence: number;
};
/** A `Truth` value in plain fields — the `{ f, c }` shape the engine speaks before
 *  `Truth` wraps it, and the half of {@link TruthLike} that has no declared name. */
export type TermTruth = {
    f: number;
    c: number;
};
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
export declare function toTermTruth(truth: TruthLike): TermTruth;
/** Belief-shaped truth from either truth representation; absent truth stays absent. */
export declare function asBeliefTruth(truth: TruthLike): BeliefTruth;
export declare function asBeliefTruth(truth: TruthLike | undefined): BeliefTruth | undefined;
/**
 * Narsese inline truth suffix ` :f:c` (empty when absent) — the single
 * rendering for terms embedded in prompt text.
 */
export declare function formatNarseseTruth(truth: TruthLike | undefined, fractionDigits?: number): string;
/**
 * Reads back what {@link formatNarseseTruth} writes. The suffix is a rendering,
 * not a grammar — the leading space is presentation and any number of decimals
 * parses — so a caller must not be stricter than the writer is.
 */
export declare function parseNarseseTruth(text: string): TermTruth | undefined;
/** Narsese `%f;c%` truth literal. */
export declare function serializeTruth(truth: TruthLike, fractionDigits?: number): string;
/** Reads back what {@link serializeTruth} writes, tolerating the whitespace a term's punctuation leaves. */
export declare function parseTruthLiteral(text: string): TermTruth | undefined;
/**
 * A Narsese sentence split into its term and the truth suffix it carries, if
 * any. The suffix is removed whole — including the whitespace inside a `%f; c%`
 * literal — so the body always parses on its own.
 */
export declare function stripTruthSuffix(text: string): {
    text: string;
    truth?: TermTruth;
};
/** The single human/LLM-readable truth rendering — prompt text must not drift between call sites. */
export declare function formatTruth(truth: TruthLike, fractionDigits?: number): string;
//# sourceMappingURL=truth.d.ts.map