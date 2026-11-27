import { clamp01 } from '../util/numeric';
export function toFrequency(value) {
    return clamp01(value);
}
export function toConfidence(value) {
    return clamp01(value);
}
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
export function toTermTruth(truth) {
    return 'f' in truth ? truth : { f: truth.frequency, c: truth.confidence };
}
export function asBeliefTruth(truth) {
    if (!truth)
        return undefined;
    const { f, c } = toTermTruth(truth);
    return { frequency: f, confidence: c };
}
/**
 * Narsese inline truth suffix ` :f:c` (empty when absent) — the single
 * rendering for terms embedded in prompt text.
 */
export function formatNarseseTruth(truth, fractionDigits = 2) {
    if (!truth)
        return '';
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
const matchTruth = (pattern, text) => {
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
export function parseNarseseTruth(text) {
    return matchTruth(NARSESE_TRUTH, text)?.truth;
}
/** Narsese `%f;c%` truth literal. */
export function serializeTruth(truth, fractionDigits = 4) {
    const { f, c } = toTermTruth(truth);
    return `%${f.toFixed(fractionDigits)};${c.toFixed(fractionDigits)}%`;
}
/** Reads back what {@link serializeTruth} writes, tolerating the whitespace a term's punctuation leaves. */
export function parseTruthLiteral(text) {
    return matchTruth(TRUTH_LITERAL, text)?.truth;
}
/**
 * A Narsese sentence split into its term and the truth suffix it carries, if
 * any. The suffix is removed whole — including the whitespace inside a `%f; c%`
 * literal — so the body always parses on its own.
 */
export function stripTruthSuffix(text) {
    const literal = matchTruth(TRUTH_LITERAL, text);
    if (literal)
        return { text: text.slice(0, literal.match.index).trim(), truth: literal.truth };
    const narsese = matchTruth(NARSESE_TRUTH, text);
    if (narsese)
        return { text: text.slice(0, narsese.match.index).trim(), truth: narsese.truth };
    return { text };
}
/** The single human/LLM-readable truth rendering — prompt text must not drift between call sites. */
export function formatTruth(truth, fractionDigits = 2) {
    const { f, c } = toTermTruth(truth);
    return `(f=${f.toFixed(fractionDigits)}, c=${c.toFixed(fractionDigits)})`;
}
