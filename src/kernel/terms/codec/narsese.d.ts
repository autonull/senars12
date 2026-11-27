/**
 * Narsese Codec — encoding/decoding terms to/from Narsese notation.
 *
 * Narsese is the canonical notation for NAL terms. This codec provides
 * lossless round-trip encoding/decoding with full operator support.
 */
import { Term } from '../intern';
import type { TruthValue } from '../../types';
/** Narsese codec options. */
export interface NarseseCodecOptions {
    /** Include truth values in output. */
    includeTruth: boolean;
    /** Include punctuation. */
    includePunctuation: boolean;
    /** Use short operator aliases. */
    shortOperators: boolean;
    /** Pretty print with indentation. */
    pretty: boolean;
    /** Indentation string. */
    indent: string;
}
/** Default codec options. */
export declare const defaultNarseseCodecOptions: NarseseCodecOptions;
/** Truth value suffix for Narsese. */
export interface TruthSuffix {
    frequency: number;
    confidence: number;
}
/** Encoded term with optional truth. */
export interface EncodedTerm {
    term: string;
    truth?: TruthSuffix;
    punctuation?: string;
}
/**
 * Encode a term to Narsese string.
 */
export declare function encodeNarsese(term: Term, options?: Partial<NarseseCodecOptions>): string;
/**
 * Encode a term with truth value.
 */
export declare function encodeNarseseWithTruth(term: Term, truth: TruthValue, options?: Partial<NarseseCodecOptions>): string;
export { escapeConstant, getPunctuation } from './formatters';
/**
 * Decode a Narsese string to a term.
 */
export declare function decodeNarsese(narsese: string): {
    term: Term;
    truth?: TruthValue;
    punctuation?: string;
};
/**
 * Batch encode multiple terms.
 */
export declare function encodeNarseseBatch(terms: Array<{
    term: Term;
    truth?: TruthValue;
}>, options?: Partial<NarseseCodecOptions>): string[];
/**
 * Batch decode multiple Narsese strings.
 */
export declare function decodeNarseseBatch(narseseStrings: string[]): Array<{
    term: Term;
    truth?: TruthValue;
    punctuation?: string;
}>;
/**
 * Round-trip test: encode then decode should preserve term structure.
 */
export declare function roundTripTest(term: Term, truth?: TruthValue): boolean;
/**
 * Parse a Narsese term with explicit truth and punctuation.
 * Used for parsing log entries, messages, etc.
 */
export interface ParsedNarsese {
    term: Term;
    truth: TruthValue;
    punctuation: string;
    raw: string;
}
export declare function parseNarseseComplete(input: string): ParsedNarsese;
/**
 * Serialize term to JSON (for storage/transport).
 */
export declare function serializeTerm(term: Term): string;
/**
 * Deserialize term from JSON.
 */
export declare function deserializeTerm(json: string): Term;
//# sourceMappingURL=narsese.d.ts.map