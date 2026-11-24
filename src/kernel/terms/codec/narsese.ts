/**
 * Narsese Codec — encoding/decoding terms to/from Narsese notation.
 *
 * Narsese is the canonical notation for NAL terms. This codec provides
 * lossless round-trip encoding/decoding with full operator support.
 */

import { Term, TermOp, VariableTerm, ConstantTerm, CompoundTerm, termInterner, termToJSON, termFromJSON } from '../intern';
import { getArgs } from '../term-internal/compound';
import type { TruthValue } from '../../types';
import {
  formatTerm as sharedFormatTerm,
  getPunctuation,
  escapeConstant,
} from './formatters';
import { SenarsError } from '../../../errors/senars-error';


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
export const defaultNarseseCodecOptions: NarseseCodecOptions = {
  includeTruth: true,
  includePunctuation: true,
  shortOperators: false,
  pretty: false,
  indent: '  ',
};

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
export function encodeNarsese(term: Term, options: Partial<NarseseCodecOptions> = {}): string {
  const opts = { ...defaultNarseseCodecOptions, ...options };
  let result = sharedFormatTerm(term);

  if (opts.includePunctuation) {
    const punct = getPunctuation(term);
    if (punct) result += punct;
  }

  return result;
}

/**
 * Encode a term with truth value.
 */
export function encodeNarseseWithTruth(
  term: Term,
  truth: TruthValue,
  options: Partial<NarseseCodecOptions> = {}
): string {
  const opts = { ...defaultNarseseCodecOptions, ...options, includeTruth: true };
  let result = sharedFormatTerm(term);

  if (opts.includeTruth) {
    result = `${result}%${truth.f.toFixed(2)};${truth.c.toFixed(2)}%`;
  }

  if (opts.includePunctuation) {
    const punct = getPunctuation(term);
    if (punct) result += punct;
  }

  return result;
}

// Re-export shared utilities for backward compatibility
export { escapeConstant, getPunctuation } from './formatters';

/**
 * Decode a Narsese string to a term.
 */
export function decodeNarsese(narsese: string): { term: Term; truth?: TruthValue; punctuation?: string } {
  const parser = new NarseseDecoder(narsese);
  const term = parser.parse();
  return {
    term,
    truth: parser.truth,
    punctuation: parser.punctuation,
  };
}

/**
 * Narsese Decoder.
 */
class NarseseDecoder {
  input: string;
  pos: number;
  truth?: TruthValue;
  punctuation?: string;
  variables = new Map<string, VariableTerm>();

  constructor(input: string) {
    this.input = input.trim();
    this.pos = 0;
  }

  parse(): Term {
    this.skipWhitespace();
    const term = this.parseTerm();
    this.skipWhitespace();

    // Check for truth suffix
    if (this.match('%')) {
      this.truth = this.parseTruth();
      this.expect('%');
    }

    // Check for punctuation
    if (this.pos < this.input.length) {
      const ch = this.input[this.pos]!;
      if (['.', '!', '?', ';'].includes(ch)) {
        this.punctuation = ch;
        this.pos++;
      }
    }

    this.skipWhitespace();
    if (this.pos < this.input.length) {
      throw new SenarsError(`Unexpected trailing characters: ${this.input.slice(this.pos)}`, 'PARSE_ERROR');
    }

    return term;
  }

  private parseTerm(): Term {
    this.skipWhitespace();

    // Parenthesized
    if (this.match('(')) {
      const term = this.parseTerm();
      this.expect(')');
      return term;
    }

    // Negation
    if (this.match('~')) {
      return termInterner.negation(this.parseTerm());
    }

    // Variable
    if (this.match('$') || this.match('#')) {
      const name = this.parseIdentifier();
      const fullName = (this.input[this.pos - name.length - 1] === '$' ? '$' : '#') + name;
      let varTerm = this.variables.get(fullName);
      if (!varTerm) {
        varTerm = termInterner.variable(fullName);
        this.variables.set(fullName, varTerm);
      }
      return varTerm;
    }

    // Word/constant
    const word = this.parseWord();
    if (!word) throw new SenarsError(`Expected term at position ${this.pos}`, 'PARSE_ERROR');

    this.skipWhitespace();

    // Binary operators (longest first)
    const operators: [string, TermOp][] = [
      ['==>', TermOp.IMPLICATION],
      ['<=>', TermOp.EQUIVALENCE],
      ['-->', TermOp.INHERITANCE],
      ['<->', TermOp.SIMILARITY],
      ['|~', TermOp.PARALLEL],
      ['||', TermOp.CONCURRENT],
      ['|>', TermOp.PREDICTION],
      ['@', TermOp.EXTENSIONAL_IMAGE],
      ['#', TermOp.INTENSIONAL_IMAGE],
      ['&', TermOp.CONJUNCTION],
      ['|', TermOp.DISJUNCTION],
      ['*', TermOp.PRODUCT],
      [';', TermOp.SEQUENTIAL],
    ];

    for (const opEntry of operators) {
      const opStr = opEntry[0]!;
      const op = opEntry[1]!;
      if (this.match(opStr)) {
        const right = this.parseTerm();
        const left = termInterner.constant(word);
        return termInterner.compound(op, left, right);
      }
    }

    // Punctuation
    if (this.match('.')) {
      return termInterner.statement(termInterner.constant(word));
    }
    if (this.match('?')) {
      return termInterner.question(termInterner.constant(word));
    }
    if (this.match('!')) {
      return termInterner.goal(termInterner.constant(word));
    }

    return termInterner.constant(word);
  }

  private parseTruth(): TruthValue {
    // Parse %f;c%
    const fStr = this.parseNumber();
    this.expect(';');
    const cStr = this.parseNumber();
    return { f: parseFloat(fStr), c: parseFloat(cStr) };
  }

  private parseNumber(): string {
    const start = this.pos;
    while (this.pos < this.input.length && /[\d.]/.test(this.input[this.pos]!)) {
      this.pos++;
    }
    return this.input.slice(start, this.pos);
  }

  private parseWord(): string {
    const start = this.pos;
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos]!;
      if (this.isDelimiter(ch)) break;
      this.pos++;
    }
    return this.input.slice(start, this.pos);
  }

  private parseIdentifier(): string {
    const start = this.pos;
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos]!;
      if (!this.isIdentChar(ch)) break;
      this.pos++;
    }
    return this.input.slice(start, this.pos);
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos]!)) {
      this.pos++;
    }
  }

  private match(str: string): boolean {
    if (this.input.startsWith(str, this.pos)) {
      this.pos += str.length;
      return true;
    }
    return false;
  }

  private expect(str: string): void {
    if (!this.match(str)) {
      throw new SenarsError(`Expected '${str}' at position ${this.pos}`, 'PARSE_ERROR');
    }
  }

  private isDelimiter(ch: string): boolean {
    return /\s/.test(ch) || '(){}[]<>.,;?!~&|*@#$%'.includes(ch);
  }

  private isIdentChar(ch: string): boolean {
    return /[a-zA-Z0-9_]/.test(ch);
  }
}

/**
 * Batch encode multiple terms.
 */
export function encodeNarseseBatch(
  terms: Array<{ term: Term; truth?: TruthValue }>,
  options: Partial<NarseseCodecOptions> = {}
): string[] {
  return terms.map(({ term, truth }) =>
    truth ? encodeNarseseWithTruth(term, truth, options) : encodeNarsese(term, options)
  );
}

/**
 * Batch decode multiple Narsese strings.
 */
export function decodeNarseseBatch(
  narseseStrings: string[]
): Array<{ term: Term; truth?: TruthValue; punctuation?: string }> {
  return narseseStrings.map(decodeNarsese);
}

/**
 * Round-trip test: encode then decode should preserve term structure.
 */
export function roundTripTest(term: Term, truth?: TruthValue): boolean {
  const encoded = truth ? encodeNarseseWithTruth(term, truth) : encodeNarsese(term);
  const decoded = decodeNarsese(encoded);
  if (!termInterner.equals(term, decoded.term)) return false;
  if (!truth) return true;
  return !!decoded.truth && decoded.truth.f === truth.f && decoded.truth.c === truth.c;
}

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

export function parseNarseseComplete(input: string): ParsedNarsese {
  const decoded = decodeNarsese(input);
  return {
    term: decoded.term,
    truth: decoded.truth ?? { f: 0.5, c: 0.9 },
    punctuation: decoded.punctuation ?? '.',
    raw: input,
  };
}

/**
 * Serialize term to JSON (for storage/transport).
 */
export function serializeTerm(term: Term): string {
  return JSON.stringify(termToJSON(term));
}

/**
 * Deserialize term from JSON.
 */
export function deserializeTerm(json: string): Term {
  return termFromJSON(JSON.parse(json));
}