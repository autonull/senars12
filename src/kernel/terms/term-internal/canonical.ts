/**
 * Canonical Term Operations — Narsese parsing and formatting.
 */

import type { Term, ConstantTerm, CompoundTerm } from './types';
import { TermOp } from '../term-ops';
import { termFactory } from './factory';

/** Escape a constant value for Narsese. */
export function escapeConstant(value: string): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) return value;
  return `'${value.replace(/'/g, "''")}'`;
}

/** Get operator symbol for Narsese. */
export function getOperatorSymbol(op: TermOp): string {
  switch (op) {
    case TermOp.INHERITANCE: return '-->';
    case TermOp.SIMILARITY: return '<->';
    case TermOp.IMPLICATION: return '==>';
    case TermOp.PREDICTIVE_IMPLICATION: return '=/>'; // or '/=>'
    case TermOp.CONJUNCTION: return '&';
    case TermOp.DISJUNCTION: return '|';
    case TermOp.NEGATION: return '-';
    case TermOp.EQUIVALENCE: return '=<=>';
    case TermOp.QUESTION_INHERITANCE: return '?-->';
    case TermOp.QUESTION_SIMILARITY: return '?<->';
    case TermOp.QUESTION_IMPLICATION: return '?==>';
    case TermOp.QUESTION_PREDICTIVE_IMPLICATION: return '?=/>';
    case TermOp.GOAL_INHERITANCE: return '!-->';
    case TermOp.GOAL_SIMILARITY: return '!<->';
    case TermOp.GOAL_IMPLICATION: return '!==>';
    case TermOp.GOAL_PREDICTIVE_IMPLICATION: return '!=/>';
    case TermOp.SEQUENCE: return ';';
    case TermOp.PARALLEL: return '||';
    case TermOp.COMPOSITE: return '*';
    case TermOp.PRODUCT: return '#';
    case TermOp.EXTENSIONAL_IMAGE: return '^';
    case TermOp.INTENSIONAL_IMAGE: return '_';
    default: return op;
  }
}

/** Get operator precedence for formatting. */
export function getPrecedence(op: TermOp): number {
  switch (op) {
    case TermOp.CONJUNCTION: return 1;
    case TermOp.DISJUNCTION: return 2;
    case TermOp.IMPLICATION:
    case TermOp.PREDICTIVE_IMPLICATION: return 3;
    case TermOp.EQUIVALENCE: return 4;
    case TermOp.INHERITANCE:
    case TermOp.SIMILARITY: return 5;
    case TermOp.NEGATION: return 6;
    case TermOp.QUESTION_INHERITANCE:
    case TermOp.QUESTION_SIMILARITY:
    case TermOp.QUESTION_IMPLICATION:
    case TermOp.QUESTION_PREDICTIVE_IMPLICATION: return 7;
    case TermOp.GOAL_INHERITANCE:
    case TermOp.GOAL_SIMILARITY:
    case TermOp.GOAL_IMPLICATION:
    case TermOp.GOAL_PREDICTIVE_IMPLICATION: return 7;
    default: return 10;
  }
}

interface FormatOptions {
  /** Use short operator symbols. */
  short?: boolean;
  /** Parenthesize all compounds. */
  fullParens?: boolean;
}

/** Format a term as Narsese string. */
export function formatTerm(term: Term, options: FormatOptions = {}): string {
  const { short = true, fullParens = false } = options;

  if (term.op === TermOp.VARIABLE) {
    return term.name;
  }
  if (term.op === TermOp.CONSTANT) {
    return escapeConstant(term.value);
  }

  const opSymbol = getOperatorSymbol(term.op);
  const args = term.args;

  // Special handling for unary operators
  if (term.op === TermOp.NEGATION && args.length === 1) {
    const argStr = formatTerm(args[0]!, { ...options, fullParens: true });
    return `${opSymbol}${argStr}`;
  }

  // Binary operators
  if (args.length === 2) {
    const left = formatTerm(args[0]!, { ...options, fullParens: fullParens || getPrecedence(args[0]!.op) < getPrecedence(term.op) });
    const right = formatTerm(args[1]!, { ...options, fullParens: fullParens || getPrecedence(args[1]!.op) <= getPrecedence(term.op) });
    return `(${left} ${opSymbol} ${right})`;
  }

  // N-ary operators
  if (args.length > 2) {
    const argStrs = args.map((a) => formatTerm(a, { ...options, fullParens: true }));
    return `(${argStrs.join(` ${opSymbol} `)})`;
  }

  // Fallback
  return `(${term.op})`;
}

/** Parse a Narsese string into a term. */
export function fromNarsese(input: string): Term | null {
  const parser = new NarseseParser();
  return parser.parse(input.trim());
}

/** Narsese parser. */
class NarseseParser {
  private input = '';
  private pos = 0;

  parse(input: string): Term | null {
    this.input = input;
    this.pos = 0;
    return this.parseTerm();
  }

  private peek(): string {
    return this.input[this.pos] ?? '';
  }

  private consume(): string {
    return this.input[this.pos++] ?? '';
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private parseTerm(): Term | null {
    this.skipWhitespace();
    if (this.pos >= this.input.length) return null;

    // Parenthesized term
    if (this.peek() === '(') {
      this.consume(); // '('
      this.skipWhitespace();
      const term = this.parseCompound();
      this.skipWhitespace();
      if (this.peek() === ')') this.consume();
      return term;
    }

    // Variable
    if (this.peek() === '_' || /[A-Z]/.test(this.peek())) {
      return this.parseVariable();
    }

    // Constant or prefixed operator
    return this.parseConstantOrPrefixed();
  }

  private parseVariable(): Term | null {
    let name = '';
    while (this.pos < this.input.length && /[A-Za-z0-9_]/.test(this.peek())) {
      name += this.consume();
    }
    if (!name) return null;
    return termFactory.variable(name);
  }

  private parseConstantOrPrefixed(): Term | null {
    // Check for prefixed operators (?, !)
    const prefix = this.peek();
    let opPrefix = '';
    if (prefix === '?' || prefix === '!') {
      opPrefix = this.consume();
    }

    // Parse the operator or constant
    if (this.peek() === '\'') {
      return this.parseQuotedConstant();
    }

    let value = '';
    while (this.pos < this.input.length && !/\s|[()&|;<>=\-]/.test(this.peek())) {
      value += this.consume();
    }

    if (!value) return null;

    // Check if it's a known operator with prefix
    const fullOp = opPrefix + value;
    const op = this.operatorFromString(fullOp);
    if (op) {
      // This is an operator, parse arguments
      this.skipWhitespace();
      if (this.peek() === '(') {
        this.consume();
        const args = this.parseArguments();
        this.skipWhitespace();
        if (this.peek() === ')') this.consume();
        return termFactory.compound(op, args);
      }
      // Operator without parens - treat as constant
      return termFactory.constant(fullOp);
    }

    return termFactory.constant(value);
  }

  private parseQuotedConstant(): Term | null {
    this.consume(); // opening '
    let value = '';
    while (this.pos < this.input.length) {
      const ch = this.consume();
      if (ch === '\'') {
        if (this.peek() === '\'') {
          value += this.consume(); // escaped quote
        } else {
          break; // closing quote
        }
      } else {
        value += ch;
      }
    }
    return termFactory.constant(value);
  }

  private parseCompound(): Term | null {
    // Parse operator
    let opStr = '';
    while (this.pos < this.input.length && !/\s|[()]/ .test(this.peek())) {
      opStr += this.consume();
    }

    const op = this.operatorFromString(opStr);
    if (!op) return null;

    // Parse arguments
    const args: Term[] = [];
    while (true) {
      this.skipWhitespace();
      if (this.peek() === ')' || this.pos >= this.input.length) break;
      const arg = this.parseTerm();
      if (!arg) break;
      args.push(arg);
    }

    return termFactory.compound(op, args);
  }

  private parseArguments(): Term[] {
    const args: Term[] = [];
    while (true) {
      this.skipWhitespace();
      if (this.peek() === ')' || this.pos >= this.input.length) break;
      const arg = this.parseTerm();
      if (!arg) break;
      args.push(arg);
      this.skipWhitespace();
      if (this.peek() === ',') this.consume();
    }
    return args;
  }

  private operatorFromString(str: string): TermOp | null {
    const map: Record<string, TermOp> = {
      '-->': TermOp.INHERITANCE,
      '<->': TermOp.SIMILARITY,
      '==>': TermOp.IMPLICATION,
      '=/=>': TermOp.PREDICTIVE_IMPLICATION,
      '&': TermOp.CONJUNCTION,
      '|': TermOp.DISJUNCTION,
      '-': TermOp.NEGATION,
      '=<=>': TermOp.EQUIVALENCE,
      '?-->': TermOp.QUESTION_INHERITANCE,
      '?<->': TermOp.QUESTION_SIMILARITY,
      '?==>': TermOp.QUESTION_IMPLICATION,
      '?=/=>': TermOp.QUESTION_PREDICTIVE_IMPLICATION,
      '!-->': TermOp.GOAL_INHERITANCE,
      '!<->': TermOp.GOAL_SIMILARITY,
      '!==>': TermOp.GOAL_IMPLICATION,
      '!=/=>': TermOp.GOAL_PREDICTIVE_IMPLICATION,
      ';': TermOp.SEQUENCE,
      '||': TermOp.PARALLEL,
      '*': TermOp.COMPOSITE,
      '#': TermOp.PRODUCT,
      '^': TermOp.EXTENSIONAL_IMAGE,
      '_': TermOp.INTENSIONAL_IMAGE,
    };
    return map[str] ?? null;
  }
}

/** Narsese formatter class. */
export class NarseseFormatter {
  private options: FormatOptions;

  constructor(options: FormatOptions = {}) {
    this.options = options;
  }

  format(term: Term): string {
    return formatTerm(term, this.options);
  }

  formatBatch(terms: Term[]): string {
    return terms.map((t) => this.format(t)).join('\n');
  }
}