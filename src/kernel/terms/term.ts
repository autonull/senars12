/**
 * Kernel Terms — the canonical term representation with structural sharing.
 *
 * Terms are the atomic units of reasoning. They are interned (identity = equality),
 * immutable, and form a DAG with maximal sharing.
 */

import type { TruthValue, Stamp } from '../types';
import type { UUID, TimestampMs } from '../types';
import { TermOp } from './term-ops';

export { TermOp } from './term-ops';

/** Base term interface. */
export interface TermBase {
  readonly op: TermOp;
  readonly hash: number;
  readonly complexity: number;
}

/** Variable term. */
export interface VariableTerm extends TermBase {
  op: TermOp.VARIABLE;
  readonly name: string;
  readonly index: number;
}

/** Constant/atom term. */
export interface ConstantTerm extends TermBase {
  op: TermOp.CONSTANT;
  readonly value: string;
}

/** Compound term (binary or n-ary). */
export interface CompoundTerm extends TermBase {
  op: Exclude<TermOp, TermOp.VARIABLE | TermOp.CONSTANT>;
  readonly args: readonly Term[];
  readonly arity: number;
}

/** Any term. */
export type Term = VariableTerm | ConstantTerm | CompoundTerm;

/** Term with stamp for the working memory. */
export interface StampedTerm {
  readonly term: Term;
  readonly stamp: Stamp;
  readonly truth: TruthValue;
}

/** Term factory with interning. */
export class TermFactory {
  private static instance: TermFactory;
  private internTable = new Map<string, Map<string, Term>>();
  private variableCounter = 0;
  private hashSeed = 0x9e3779b9;

  private constructor() {
    // Initialize intern tables for each op
    for (const op of Object.values(TermOp)) {
      this.internTable.set(op, new Map());
    }
  }

  /** Get the singleton factory. */
  static getInstance(): TermFactory {
    if (!TermFactory.instance) {
      TermFactory.instance = new TermFactory();
    }
    return TermFactory.instance;
  }

  /** Reset the factory (for testing). */
  static reset(): void {
    TermFactory.instance = new TermFactory();
  }

  /** Create a variable term. */
  variable(name: string): VariableTerm {
    const key = `var:${name}`;
    const table = this.internTable.get(TermOp.VARIABLE)!;
    let term = table.get(key);
    if (term) return term as VariableTerm;

    term = Object.freeze({
      op: TermOp.VARIABLE,
      name,
      index: this.variableCounter++,
      hash: this.hashString(key),
      complexity: 1,
    });
    table.set(key, term);
    return term as VariableTerm;
  }

  /** Create a constant term. */
  constant(value: string): ConstantTerm {
    const key = `const:${value}`;
    const table = this.internTable.get(TermOp.CONSTANT)!;
    let term = table.get(key);
    if (term) return term as ConstantTerm;

    term = Object.freeze({
      op: TermOp.CONSTANT,
      value,
      hash: this.hashString(key),
      complexity: 1,
    });
    table.set(key, term);
    return term as ConstantTerm;
  }

  /** Create a compound term. */
  compound(op: TermOp, ...args: Term[]): CompoundTerm {
    const argHashes = args.map(a => a.hash).join(',');
    const key = `${op}:${argHashes}`;
    const table = this.internTable.get(op)!;
    let term = table.get(key);
    if (term) return term as CompoundTerm;

    const complexity = 1 + args.reduce((sum, a) => sum + a.complexity, 0);
    const compoundOp = op as Exclude<TermOp, TermOp.VARIABLE | TermOp.CONSTANT>;
    const compound: CompoundTerm = Object.freeze({
      op: compoundOp,
      args: Object.freeze([...args]),
      arity: args.length,
      hash: this.hashString(key),
      complexity,
    });
    table.set(key, compound);
    return compound;
  }

  /** Inheritance (S --> P). */
  inheritance(subject: Term, predicate: Term): CompoundTerm {
    return this.compound(TermOp.INHERITANCE, subject, predicate);
  }

  /** Similarity (S <-> P). */
  similarity(subject: Term, predicate: Term): CompoundTerm {
    return this.compound(TermOp.SIMILARITY, subject, predicate);
  }

  /** Implication (S ==> P). */
  implication(antecedent: Term, consequent: Term): CompoundTerm {
    return this.compound(TermOp.IMPLICATION, antecedent, consequent);
  }

  /** Equivalence (S <=> P). */
  equivalence(left: Term, right: Term): CompoundTerm {
    return this.compound(TermOp.EQUIVALENCE, left, right);
  }

  /** Conjunction (A & B & ...). */
  conjunction(...terms: Term[]): CompoundTerm {
    return this.compound(TermOp.CONJUNCTION, ...terms);
  }

  /** Disjunction (A | B | ...). */
  disjunction(...terms: Term[]): CompoundTerm {
    return this.compound(TermOp.DISJUNCTION, ...terms);
  }

  /** Negation (~A). */
  negation(term: Term): CompoundTerm {
    return this.compound(TermOp.NEGATION, term);
  }

  /** Product (A * B * ...). */
  product(...terms: Term[]): CompoundTerm {
    return this.compound(TermOp.PRODUCT, ...terms);
  }

  /** Extensional image (A @ B). */
  extensionalImage(term: Term, image: Term): CompoundTerm {
    return this.compound(TermOp.EXTENSIONAL_IMAGE, term, image);
  }

  /** Intensional image (A # B). */
  intensionalImage(term: Term, image: Term): CompoundTerm {
    return this.compound(TermOp.INTENSIONAL_IMAGE, term, image);
  }

  /** Prediction (A |> B). */
  prediction(term: Term, predicted: Term): CompoundTerm {
    return this.compound(TermOp.PREDICTION, term, predicted);
  }

  /** Concurrent (A || B). */
  concurrent(...terms: Term[]): CompoundTerm {
    return this.compound(TermOp.CONCURRENT, ...terms);
  }

  /** Sequential (A ; B). */
  sequential(...terms: Term[]): CompoundTerm {
    return this.compound(TermOp.SEQUENTIAL, ...terms);
  }

  /** Parallel (A |~ B). */
  parallel(...terms: Term[]): CompoundTerm {
    return this.compound(TermOp.PARALLEL, ...terms);
  }

  /** Statement (term.) */
  statement(term: Term): CompoundTerm {
    return this.compound(TermOp.STATEMENT, term);
  }

  /** Question (term?) */
  question(term: Term): CompoundTerm {
    return this.compound(TermOp.QUESTION, term);
  }

  /** Goal (term!) */
  goal(term: Term): CompoundTerm {
    return this.compound(TermOp.GOAL, term);
  }

  /** Parse a Narsese string into a term. */
  parse(narsese: string): Term {
    return NarseseParser.parse(this, narsese);
  }

  /** Format a term as Narsese. */
  format(term: Term): string {
    return NarseseFormatter.format(term);
  }

  /** Check if two terms are identical (by interning, this is reference equality). */
  equals(a: Term, b: Term): boolean {
    return a === b;
  }

  /** Get term hash. */
  getHash(term: Term): number {
    return term.hash;
  }

  /** Get term complexity. */
  getComplexity(term: Term): number {
    return term.complexity;
  }

  /** Get all interned terms (for debugging). */
  getAllTerms(): Term[] {
    const all: Term[] = [];
    for (const table of this.internTable.values()) {
      all.push(...table.values());
    }
    return all;
  }

  /** Get intern table size. */
  getSize(): number {
    let size = 0;
    for (const table of this.internTable.values()) {
      size += table.size;
    }
    return size;
  }

  /** Hash a string to a 32-bit integer. */
  private hashString(str: string): number {
    let hash = this.hashSeed;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(hash ^ str.charCodeAt(i), 0x85ebca6b);
      hash ^= hash >>> 13;
      hash = Math.imul(hash, 0xc2b2ae35);
      hash ^= hash >>> 16;
    }
    return hash >>> 0;
  }
}

/** Get the global term factory. */
export const termFactory = TermFactory.getInstance();

/**
 * Narsese Parser — parses Narsese strings into interned terms.
 */
class NarseseParser {
  private factory: TermFactory;
  private input: string;
  private pos: number;
  private variables = new Map<string, VariableTerm>();

  static parse(factory: TermFactory, input: string): Term {
    const parser = new NarseseParser(factory, input);
    return parser.parseTerm();
  }

  private constructor(factory: TermFactory, input: string) {
    this.factory = factory;
    this.input = input.trim();
    this.pos = 0;
  }

  private parseTerm(): Term {
    this.skipWhitespace();
    const start = this.pos;
    const term = this.parseCompound();
    this.skipWhitespace();
    // Handle postfix punctuation (. ? !)
    if (this.match('.')) return this.factory.statement(term);
    if (this.match('?')) return this.factory.question(term);
    if (this.match('!')) return this.factory.goal(term);
    if (this.pos < this.input.length) {
      throw new Error(`Unexpected character at position ${this.pos}: ${this.input[this.pos]}`);
    }
    return term;
  }

  private parseCompound(): Term {
    this.skipWhitespace();
    const left = this.parsePrimary();
    return this.parseBinary(left, 0);
  }

  private parsePrimary(): Term {
    this.skipWhitespace();

    // Parenthesized
    if (this.match('(')) {
      const term = this.parseCompound();
      this.expect(')');
      return term;
    }

    // Negation
    if (this.match('~')) {
      return this.factory.negation(this.parsePrimary());
    }

    // Variable
    if (this.match('$') || this.match('#')) {
      const prefix = this.input[this.pos - 1]!;
      const name = this.parseIdentifier();
      const fullName = prefix + name;
      let varTerm = this.variables.get(fullName);
      if (!varTerm) {
        varTerm = this.factory.variable(fullName);
        this.variables.set(fullName, varTerm);
      }
      return varTerm;
    }

    // Constant/word
    const word = this.parseWord();
    if (!word) throw new Error(`Expected term at position ${this.pos}`);
    return this.factory.constant(word);
  }

  private parseBinary(left: Term, minPrec: number): Term {
    this.skipWhitespace();

    const ops: Array<{ op: string; prec: number; assoc: 'left' | 'right'; factory: (l: Term, r: Term) => Term; nary: boolean }> = [
      { op: '-->', prec: 10, assoc: 'right', factory: (l, r) => this.factory.inheritance(l, r), nary: false },
      { op: '<->', prec: 10, assoc: 'right', factory: (l, r) => this.factory.similarity(l, r), nary: false },
      { op: '==>', prec: 10, assoc: 'right', factory: (l, r) => this.factory.implication(l, r), nary: false },
      { op: '<=>', prec: 10, assoc: 'right', factory: (l, r) => this.factory.equivalence(l, r), nary: false },
      { op: '@', prec: 10, assoc: 'right', factory: (l, r) => this.factory.extensionalImage(l, r), nary: false },
      { op: '#', prec: 10, assoc: 'right', factory: (l, r) => this.factory.intensionalImage(l, r), nary: false },
      { op: '|>', prec: 10, assoc: 'right', factory: (l, r) => this.factory.prediction(l, r), nary: false },
      { op: '&', prec: 20, assoc: 'left', factory: (l, r) => this.factory.conjunction(l, r), nary: true },
      { op: '|', prec: 20, assoc: 'left', factory: (l, r) => this.factory.disjunction(l, r), nary: true },
      { op: '*', prec: 20, assoc: 'left', factory: (l, r) => this.factory.product(l, r), nary: true },
      { op: '||', prec: 20, assoc: 'left', factory: (l, r) => this.factory.concurrent(l, r), nary: true },
      { op: ';', prec: 20, assoc: 'left', factory: (l, r) => this.factory.sequential(l, r), nary: true },
      { op: '|~', prec: 20, assoc: 'left', factory: (l, r) => this.factory.parallel(l, r), nary: true },
    ];

    let current = left;

    while (true) {
      this.skipWhitespace();
      let matched = false;

      for (const { op, prec, assoc, factory, nary } of ops) {
        if (prec < minPrec) continue;
        if (this.match(op)) {
          if (nary) {
            // Collect all consecutive same operators
            const args: Term[] = [current];
            while (true) {
              const nextMinPrec = assoc === 'left' ? prec + 1 : prec;
              const right = this.parseBinary(this.parsePrimary(), nextMinPrec);
              args.push(right);
              this.skipWhitespace();
              if (!this.match(op)) break;
            }
            // Create n-ary compound
            current = this.factory.compound(
              this.opStringToTermOp(op),
              ...args
            );
          } else {
            const nextMinPrec = assoc === 'left' ? prec + 1 : prec;
            const right = this.parseBinary(this.parsePrimary(), nextMinPrec);
            current = factory(current, right);
          }
          matched = true;
          break;
        }
      }

      if (!matched) break;
    }

    return current;
  }

  private opStringToTermOp(op: string): TermOp {
    switch (op) {
      case '&': return TermOp.CONJUNCTION;
      case '|': return TermOp.DISJUNCTION;
      case '*': return TermOp.PRODUCT;
      case '||': return TermOp.CONCURRENT;
      case ';': return TermOp.SEQUENTIAL;
      case '|~': return TermOp.PARALLEL;
      default: throw new Error(`Unknown n-ary operator: ${op}`);
    }
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
    return /\s/.test(ch) || '(){}[]<>.,;?!~&|*@#$'.includes(ch);
  }

  private isIdentChar(ch: string): boolean {
    return /[a-zA-Z0-9_]/.test(ch);
  }
}

/**
 * Narsese Formatter — formats terms as Narsese strings.
 * Local implementation to avoid cycle with ./codec/formatters.ts
 */
const OPERATOR_SYMBOLS: Record<TermOp, string> = {
  [TermOp.INHERITANCE]: '-->',
  [TermOp.SIMILARITY]: '<->',
  [TermOp.IMPLICATION]: '==>',
  [TermOp.EQUIVALENCE]: '<=>',
  [TermOp.CONJUNCTION]: '&',
  [TermOp.DISJUNCTION]: '|',
  [TermOp.PRODUCT]: '*',
  [TermOp.EXTENSIONAL_IMAGE]: '@',
  [TermOp.INTENSIONAL_IMAGE]: '#',
  [TermOp.PREDICTION]: '|>',
  [TermOp.CONCURRENT]: '||',
  [TermOp.SEQUENTIAL]: ';',
  [TermOp.PARALLEL]: '|~',
  [TermOp.NEGATION]: '~',
  [TermOp.VARIABLE]: '',
  [TermOp.CONSTANT]: '',
  [TermOp.STATEMENT]: '.',
  [TermOp.QUESTION]: '?',
  [TermOp.GOAL]: '!',
};

const PRECEDENCE: Record<TermOp, number> = {
  [TermOp.VARIABLE]: 100,
  [TermOp.CONSTANT]: 100,
  [TermOp.NEGATION]: 90,
  [TermOp.INHERITANCE]: 80,
  [TermOp.SIMILARITY]: 80,
  [TermOp.IMPLICATION]: 80,
  [TermOp.EQUIVALENCE]: 80,
  [TermOp.EXTENSIONAL_IMAGE]: 80,
  [TermOp.INTENSIONAL_IMAGE]: 80,
  [TermOp.PREDICTION]: 80,
  [TermOp.CONJUNCTION]: 70,
  [TermOp.DISJUNCTION]: 70,
  [TermOp.PRODUCT]: 70,
  [TermOp.CONCURRENT]: 60,
  [TermOp.SEQUENTIAL]: 60,
  [TermOp.PARALLEL]: 60,
  [TermOp.STATEMENT]: 50,
  [TermOp.QUESTION]: 50,
  [TermOp.GOAL]: 50,
};

const BINARY_OPS = new Set<TermOp>([
  TermOp.INHERITANCE,
  TermOp.SIMILARITY,
  TermOp.IMPLICATION,
  TermOp.EQUIVALENCE,
  TermOp.EXTENSIONAL_IMAGE,
  TermOp.INTENSIONAL_IMAGE,
  TermOp.PREDICTION,
]);

const NARY_OPS = new Set<TermOp>([
  TermOp.CONJUNCTION,
  TermOp.DISJUNCTION,
  TermOp.PRODUCT,
  TermOp.CONCURRENT,
  TermOp.SEQUENTIAL,
  TermOp.PARALLEL,
]);

function escapeConstant(value: string): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) return value;
  return `'${value.replace(/'/g, "\\'")}'`;
}

function getOperatorSymbol(op: TermOp): string {
  return OPERATOR_SYMBOLS[op] ?? '';
}

function getPrecedence(op: TermOp): number {
  return PRECEDENCE[op] ?? 0;
}

function formatTerm(term: Term, parentPrec = 0): string {
  const opPrec = getPrecedence(term.op);
  const needsParens = opPrec < parentPrec;
  const args = getArgs(term);

  let result: string;

  switch (term.op) {
    case TermOp.VARIABLE:
      result = (term as VariableTerm).name;
      break;

    case TermOp.CONSTANT:
      result = escapeConstant((term as ConstantTerm).value);
      break;

    case TermOp.NEGATION:
      result = '~' + formatTerm(args![0]!, getPrecedence(TermOp.NEGATION));
      break;

    case TermOp.STATEMENT:
      result = formatTerm(args![0]!, opPrec) + '.';
      break;

    case TermOp.QUESTION:
      result = formatTerm(args![0]!, opPrec) + '?';
      break;

    case TermOp.GOAL:
      result = formatTerm(args![0]!, opPrec) + '!';
      break;

    default: {
      if (BINARY_OPS.has(term.op)) {
        const op = getOperatorSymbol(term.op);
        const left = args![0]!;
        const right = args![1]!;
        const leftStr = formatTerm(left, opPrec + 1);
        const rightStr = formatTerm(right, opPrec + 1);
        result = `${leftStr} ${op} ${rightStr}`;
      } else if (NARY_OPS.has(term.op)) {
        const op = getOperatorSymbol(term.op);
        const parts = args!.map(arg => formatTerm(arg, opPrec + 1));
        result = parts.join(` ${op} `);
      } else {
        result = '';
      }
      break;
    }
  }

  return needsParens ? `(${result})` : result;
}

class NarseseFormatter {
  static format(term: Term): string {
    return formatTerm(term);
  }
}

/** Get arguments of a compound term. */
export function getArgs(term: Term): readonly Term[] {
  if (term.op === TermOp.VARIABLE || term.op === TermOp.CONSTANT) {
    return [];
  }
  return (term as CompoundTerm).args;
}

/** Check if term is an inheritance. */
export function isInheritance(term: Term): boolean {
  return term.op === TermOp.INHERITANCE;
}

/** Check if term is a conjunction. */
export function isConjunction(term: Term): boolean {
  return term.op === TermOp.CONJUNCTION;
}

/** Check if term is a disjunction. */
export function isDisjunction(term: Term): boolean {
  return term.op === TermOp.DISJUNCTION;
}

/** Check if term is a negation. */
export function isNegation(term: Term): boolean {
  return term.op === TermOp.NEGATION;
}

/** Check if term is a similarity. */
export function isSimilarity(term: Term): boolean {
  return term.op === TermOp.SIMILARITY;
}

/** Check if term is an implication. */
export function isImplication(term: Term): boolean {
  return term.op === TermOp.IMPLICATION;
}

/** Check if term is an equivalence. */
export function isEquivalence(term: Term): boolean {
  return term.op === TermOp.EQUIVALENCE;
}

/** Check if term is a statement. */
export function isStatement(term: Term): boolean {
  return term.op === TermOp.STATEMENT;
}

/** Check if term is a question. */
export function isQuestion(term: Term): boolean {
  return term.op === TermOp.QUESTION;
}

/** Check if term is a goal. */
export function isGoal(term: Term): boolean {
  return term.op === TermOp.GOAL;
}

/** Check if term is atomic (variable or constant). */
export function isAtomic(term: Term): boolean {
  return term.op === TermOp.VARIABLE || term.op === TermOp.CONSTANT;
}

/** Check if term is compound. */
export function isCompound(term: Term): boolean {
  return !isAtomic(term);
}

/** Check if term contains a variable. */
export function hasVariable(term: Term): boolean {
  if (term.op === TermOp.VARIABLE) return true;
  if (term.op === TermOp.CONSTANT) return false;
  return (term as CompoundTerm).args.some(hasVariable);
}

/** Get all symbols in a term. */
export function getSymbols(term: Term): Set<string> {
  const symbols = new Set<string>();
  if (term.op === TermOp.CONSTANT) {
    symbols.add((term as ConstantTerm).value);
  } else if (term.op === TermOp.VARIABLE) {
    symbols.add((term as VariableTerm).name);
  } else {
    for (const arg of (term as CompoundTerm).args) {
      for (const s of getSymbols(arg)) symbols.add(s);
    }
  }
  return symbols;
}

/** Check if two terms share a symbol. */
export function sharesSymbol(a: Term, b: Term): boolean {
  const aSyms = getSymbols(a);
  const bSyms = getSymbols(b);
  for (const s of aSyms) if (bSyms.has(s)) return true;
  return false;
}

/** Calculate structural similarity between two terms. */
export function calculateSimilarity(a: Term, b: Term): number {
  const aSyms = getSymbols(a);
  const bSyms = getSymbols(b);
  if (aSyms.size === 0 && bSyms.size === 0) return 1;
  if (aSyms.size === 0 || bSyms.size === 0) return 0;
  let intersection = 0;
  for (const s of aSyms) if (bSyms.has(s)) intersection++;
  return intersection / (aSyms.size + bSyms.size - intersection);
}

/** Walk a term and apply a visitor. */
export function visitTerms(term: Term, visitor: (t: Term) => void): void {
  visitor(term);
  if (term.op !== TermOp.VARIABLE && term.op !== TermOp.CONSTANT) {
    for (const arg of (term as CompoundTerm).args) {
      visitTerms(arg, visitor);
    }
  }
}

/** Get term key for interning. */
export function termKey(term: Term): string {
  return term.hash.toString(36);
}

/** Parse Narsese string to term (simplified). */
export function fromNarsese(input: string): Term | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Handle punctuation
  let punctuation: TermOp | null = null;
  let content = trimmed;
  if (trimmed.endsWith('.')) {
    punctuation = TermOp.STATEMENT;
    content = trimmed.slice(0, -1).trim();
  } else if (trimmed.endsWith('?')) {
    punctuation = TermOp.QUESTION;
    content = trimmed.slice(0, -1).trim();
  } else if (trimmed.endsWith('!')) {
    punctuation = TermOp.GOAL;
    content = trimmed.slice(0, -1).trim();
  }

  const factory = TermFactory.getInstance();
  const term = parseTermContent(content, factory);

  if (punctuation && term) {
    return factory.compound(punctuation, term);
  }
  return term;
}

function parseTermContent(content: string, factory: TermFactory): Term | null {
  const trimmed = content.trim();

  // Check for parentheses
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return parseTermContent(trimmed.slice(1, -1).trim(), factory);
  }

  // Check for negation
  if (trimmed.startsWith('~')) {
    const inner = parseTermContent(trimmed.slice(1).trim(), factory);
    if (inner) return factory.compound(TermOp.NEGATION, inner);
    return null;
  }

  // Check for binary operators (simplified - finds first top-level operator)
  const ops = [
    { op: TermOp.EQUIVALENCE, sym: '<=>' },
    { op: TermOp.IMPLICATION, sym: '==>' },
    { op: TermOp.SIMILARITY, sym: '<->' },
    { op: TermOp.INHERITANCE, sym: '-->' },
    { op: TermOp.CONJUNCTION, sym: '&' },
    { op: TermOp.DISJUNCTION, sym: '|' },
    { op: TermOp.CONCURRENT, sym: '||' },
    { op: TermOp.SEQUENTIAL, sym: ';' },
    { op: TermOp.PARALLEL, sym: '|~' },
    { op: TermOp.EXTENSIONAL_IMAGE, sym: '@' },
    { op: TermOp.INTENSIONAL_IMAGE, sym: '#' },
    { op: TermOp.PREDICTION, sym: '|>' },
    { op: TermOp.PRODUCT, sym: '*' },
  ];

  for (const { op, sym } of ops) {
    const idx = findTopLevelOperator(trimmed, sym);
    if (idx >= 0) {
      const left = parseTermContent(trimmed.slice(0, idx).trim(), factory);
      const right = parseTermContent(trimmed.slice(idx + sym.length).trim(), factory);
      if (left && right) {
        return factory.compound(op, left, right);
      }
    }
  }

  // Variable or constant
  if (/^\?[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    return factory.variable(trimmed.slice(1));
  }
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    return factory.constant(trimmed);
  }
  if (/^'[^']*'$/.test(trimmed)) {
    return factory.constant(trimmed.slice(1, -1).replace(/\\'/g, "'"));
  }

  return null;
}

function findTopLevelOperator(str: string, op: string): number {
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && str.startsWith(op, i)) {
      // Check it's not part of a longer operator
      const before = i > 0 ? str[i - 1] ?? '' : '';
      const after = i + op.length < str.length ? str[i + op.length] ?? '' : '';
      if (!/[\w]/.test(before) && !/[\w]/.test(after)) {
        return i;
      }
    }
  }
  return -1;
}