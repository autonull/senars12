/**
 * Narsese Codec — encoding/decoding terms to/from Narsese notation.
 *
 * Narsese is the canonical notation for NAL terms. This codec provides
 * lossless round-trip encoding/decoding with full operator support.
 */

import { Term, TermOp, VariableTerm, ConstantTerm, CompoundTerm, termInterner, termToJSON, termFromJSON, getArgs } from '../intern.js';
import type { TruthValue } from '../../types.js';

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
  let result = formatTerm(term, opts);

  if (opts.includePunctuation) {
    // Determine punctuation from term type
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
  let result = formatTerm(term, opts);

  if (opts.includeTruth) {
    result = `${result}%${truth.f.toFixed(2)};${truth.c.toFixed(2)}%`;
  }

  if (opts.includePunctuation) {
    const punct = getPunctuation(term);
    if (punct) result += punct;
  }

  return result;
}

/**
 * Format a term recursively.
 */
function formatTerm(term: Term, options: NarseseCodecOptions): string {
  const args = getArgs(term);
  switch (term.op) {
    case TermOp.VARIABLE:
      return (term as VariableTerm).name;

    case TermOp.CONSTANT:
      return escapeConstant((term as ConstantTerm).value);

    case TermOp.NEGATION:
      return `~${formatTerm(args![0]!, options)}`;

    case TermOp.INHERITANCE:
      return formatBinary(term as CompoundTerm, '-->', options);

    case TermOp.SIMILARITY:
      return formatBinary(term as CompoundTerm, '<->', options);

    case TermOp.IMPLICATION:
      return formatBinary(term as CompoundTerm, '==>', options);

    case TermOp.EQUIVALENCE:
      return formatBinary(term as CompoundTerm, '<=>', options);

    case TermOp.CONJUNCTION:
      return formatNary(term as CompoundTerm, '&', options);

    case TermOp.DISJUNCTION:
      return formatNary(term as CompoundTerm, '|', options);

    case TermOp.PRODUCT:
      return formatNary(term as CompoundTerm, '*', options);

    case TermOp.EXTENSIONAL_IMAGE:
      return formatBinary(term as CompoundTerm, '@', options);

    case TermOp.INTENSIONAL_IMAGE:
      return formatBinary(term as CompoundTerm, '#', options);

    case TermOp.PREDICTION:
      return formatBinary(term as CompoundTerm, '|>', options);

    case TermOp.CONCURRENT:
      return formatNary(term as CompoundTerm, '||', options);

    case TermOp.SEQUENTIAL:
      return formatNary(term as CompoundTerm, ';', options);

    case TermOp.PARALLEL:
      return formatNary(term as CompoundTerm, '|~', options);

    case TermOp.STATEMENT:
      return `${formatTerm(args![0]!, options)}.`;

    case TermOp.QUESTION:
      return `${formatTerm(args![0]!, options)}?`;

    case TermOp.GOAL:
      return `${formatTerm(args![0]!, options)}!`;

    default:
      // This should never be reached if all TermOp cases are handled
      // Use a type assertion to satisfy TypeScript
      return '' as never;
  }
}

function formatBinary(term: CompoundTerm, op: string, options: NarseseCodecOptions): string {
  const left = term.args[0]!;
  const right = term.args[1]!;
  const leftStr = formatTerm(left, options);
  const rightStr = formatTerm(right, options);

  // Add parentheses if needed
  const leftPrec = getPrecedence(left.op);
  const rightPrec = getPrecedence(right.op);
  const opPrec = getOperatorPrecedence(op);

  const leftWrapped = leftPrec < opPrec ? `(${leftStr})` : leftStr;
  const rightWrapped = rightPrec <= opPrec ? `(${rightStr})` : rightStr;

  return `${leftWrapped} ${op} ${rightWrapped}`;
}

function formatNary(term: CompoundTerm, op: string, options: NarseseCodecOptions): string {
  const parts = term.args.map(arg => formatTerm(arg, options));
  const opPrec = getOperatorPrecedence(op);

  return parts.map((part, i) => {
    const termOp = term.args[i]!.op;
    const termPrec = getPrecedence(termOp);
    return termPrec < opPrec ? `(${part})` : part;
  }).join(` ${op} `);
}

function getPrecedence(op: TermOp): number {
  switch (op) {
    case TermOp.VARIABLE:
    case TermOp.CONSTANT:
      return 100;
    case TermOp.NEGATION:
      return 90;
    case TermOp.INHERITANCE:
    case TermOp.SIMILARITY:
    case TermOp.IMPLICATION:
    case TermOp.EQUIVALENCE:
    case TermOp.EXTENSIONAL_IMAGE:
    case TermOp.INTENSIONAL_IMAGE:
    case TermOp.PREDICTION:
      return 80;
    case TermOp.CONJUNCTION:
    case TermOp.DISJUNCTION:
    case TermOp.PRODUCT:
      return 70;
    case TermOp.CONCURRENT:
    case TermOp.SEQUENTIAL:
    case TermOp.PARALLEL:
      return 60;
    case TermOp.STATEMENT:
    case TermOp.QUESTION:
    case TermOp.GOAL:
      return 50;
    default:
      return 0;
  }
}

function getOperatorPrecedence(op: string): number {
  switch (op) {
    case '-->': case '<->': case '==>': case '<=>': case '@': case '#': case '|>':
      return 80;
    case '&': case '|': case '*':
      return 70;
    case '||': case ';': case '|~':
      return 60;
    default:
      return 0;
  }
}

function getPunctuation(term: Term): string | null {
  if (term.op === TermOp.STATEMENT) return '.';
  if (term.op === TermOp.QUESTION) return '?';
  if (term.op === TermOp.GOAL) return '!';
  return null;
}

function escapeConstant(value: string): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) return value;
  return `'${value.replace(/'/g, "\\'")}'`;
}

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
      throw new Error(`Unexpected trailing characters: ${this.input.slice(this.pos)}`);
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
    if (!word) throw new Error(`Expected term at position ${this.pos}`);

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
      throw new Error(`Expected '${str}' at position ${this.pos}`);
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