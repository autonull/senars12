/**
 * Canonical Terms — normalized term representation for equality and indexing.
 *
 * Canonical form ensures that structurally equivalent terms have identical
 * representations. This includes:
 * - Variable standardization (de Bruijn indices)
 * - Commutative argument sorting
 * - Associative flattening
 * - Redundant operator elimination
 */

import { Term, TermOp, VariableTerm, ConstantTerm, CompoundTerm, termInterner, visitTerm, mapTerm, TermVisitor } from './intern';
import { getArgs } from './term';

/** Canonical term representation. */
export interface CanonicalTerm {
  /** Canonical hash (structural hash). */
  hash: number;
  /** De Bruijn representation (variables as indices). */
  debruijn: DebrTerm;
  /** Free variable names in order. */
  freeVars: string[];
}

/** De Bruijn term (variables as numeric indices). */
export type DebrTerm =
  | { type: 'var'; index: number }
  | { type: 'const'; value: string }
  | { type: 'compound'; op: TermOp; args: DebrTerm[] };

/** Canonicalization options. */
export interface CanonicalOptions {
  /** Sort commutative arguments. */
  sortCommutative: boolean;
  /** Flatten associative operators. */
  flattenAssociative: boolean;
  /** Eliminate double negation. */
  eliminateDoubleNegation: boolean;
  /** Normalize equivalence/implication. */
  normalizeImplication: boolean;
}

/** Default canonicalization options. */
export const defaultCanonicalOptions: CanonicalOptions = {
  sortCommutative: true,
  flattenAssociative: true,
  eliminateDoubleNegation: true,
  normalizeImplication: true,
};

/** Commutative operators. */
const COMMUTATIVE_OPS = new Set([
  TermOp.CONJUNCTION,
  TermOp.DISJUNCTION,
  TermOp.SIMILARITY,
  TermOp.EQUIVALENCE,
  TermOp.PRODUCT,
]);

/** Associative operators. */
const ASSOCIATIVE_OPS = new Set([
  TermOp.CONJUNCTION,
  TermOp.DISJUNCTION,
  TermOp.PRODUCT,
  TermOp.CONCURRENT,
  TermOp.SEQUENTIAL,
]);

/**
 * Convert a term to canonical form.
 */
export function canonicalize(term: Term, options: Partial<CanonicalOptions> = {}): CanonicalTerm {
  const opts = { ...defaultCanonicalOptions, ...options };

  // Step 1: Full normalization pipeline (implication, associative flattening, commutative sorting, double negation)
  let normalized = normalizeTermPipeline(term, opts);

  // Step 2: Convert to de Bruijn indices
  const { debruijn, freeVars } = toDebrTerm(normalized);

  // Step 3: Compute structural hash
  const hash = hashDebrTerm(debruijn);

  return { hash, debruijn, freeVars };
}

/**
 * Normalize a term according to canonicalization rules.
 */
function normalizeTerm(term: Term, options: CanonicalOptions): Term {
  return mapTerm(term, t => {
    if (t.op !== TermOp.NEGATION) return t;
    const args = getArgs(t);
    if (!args || args.length === 0) return t;
    const firstArg = args[0]!;

    // Eliminate double negation: ~~A -> A
    if (options.eliminateDoubleNegation && firstArg.op === TermOp.NEGATION) {
      const innerArgs = getArgs(firstArg);
      if (innerArgs && innerArgs.length > 0) {
        return innerArgs[0]!;
      }
    }
    return t;
  });
}

/**
 * Flatten associative operators: (A & B) & C -> A & B & C
 */
function flattenAssociative(term: Term, options: CanonicalOptions): Term {
  if (!options.flattenAssociative) return term;

  return mapTerm(term, t => {
    if (!ASSOCIATIVE_OPS.has(t.op)) return t;

    const compound = t as CompoundTerm;
    const flattened: Term[] = [];

    const collect = (arg: Term) => {
      if (arg.op === t.op) {
        for (const a of (arg as CompoundTerm).args) collect(a);
      } else {
        flattened.push(arg);
      }
    };

    for (const arg of compound.args) collect(arg);

    if (flattened.length === compound.args.length) return t;

    // Sort if commutative
    if (options.sortCommutative && COMMUTATIVE_OPS.has(t.op)) {
      flattened.sort((a, b) => termInterner.hash(a) - termInterner.hash(b));
    }

    return termInterner.compound(t.op, ...flattened);
  });
}

/**
 * Sort commutative arguments.
 */
function sortCommutative(term: Term, options: CanonicalOptions): Term {
  if (!options.sortCommutative) return term;

  return mapTerm(term, t => {
    if (!COMMUTATIVE_OPS.has(t.op)) return t;
    const args = getArgs(t);
    if (!args || args.length <= 1) return t;

    const sorted = [...args].sort((a, b) => termInterner.hash(a) - termInterner.hash(b));

    // Check if already sorted
    let same = true;
    for (let i = 0; i < args.length; i++) {
      if (args[i] !== sorted[i]) { same = false; break; }
    }
    if (same) return t;

    return termInterner.compound(t.op, ...sorted);
  });
}

/**
 * Normalize implication: A ==> B becomes ~A | B
 * Normalize equivalence: A <=> B becomes (A ==> B) & (B ==> A)
 */
function normalizeImplication(term: Term, options: CanonicalOptions): Term {
  if (!options.normalizeImplication) return term;

  return mapTerm(term, t => {
    const args = getArgs(t);
    if (!args) return t;

    if (t.op === TermOp.IMPLICATION) {
      const antecedent = args[0]!;
      const consequent = args[1]!;
      return termInterner.disjunction(
        termInterner.negation(antecedent),
        consequent
      );
    }
    if (t.op === TermOp.EQUIVALENCE) {
      const left = args[0]!;
      const right = args[1]!;
      return termInterner.conjunction(
        termInterner.implication(left, right),
        termInterner.implication(right, left)
      );
    }
    return t;
  });
}

/**
 * Full normalization pipeline.
 */
function normalizeTermPipeline(term: Term, options: CanonicalOptions): Term {
  let result = term;
  result = normalizeImplication(result, options);
  result = flattenAssociative(result, options);
  result = sortCommutative(result, options);
  result = normalizeTerm(result, options); // Double negation after other transforms
  return result;
}

/**
 * Convert to de Bruijn representation.
 * Bound variables become indices; free variables keep names.
 */
function toDebrTerm(term: Term): { debruijn: DebrTerm; freeVars: string[] } {
  const boundVars = new Map<VariableTerm, number>();
  const freeVars: string[] = [];
  let nextIndex = 0;

  const convert = (t: Term): DebrTerm => {
    if (t.op === TermOp.VARIABLE) {
      const vt = t as VariableTerm;
      const idx = boundVars.get(vt);
      if (idx !== undefined) {
        return { type: 'var', index: idx };
      }
      // Free variable
      const freeIdx = freeVars.indexOf(vt.name);
      if (freeIdx >= 0) {
        return { type: 'var', index: -(freeIdx + 1) }; // Negative for free vars
      }
      freeVars.push(vt.name);
      return { type: 'var', index: -freeVars.length };
    }
    if (t.op === TermOp.CONSTANT) {
      return { type: 'const', value: (t as ConstantTerm).value };
    }
    const ct = t as CompoundTerm;
    // Handle binders (forall, exists, lambda) - for now treat all as non-binding
    // In a full implementation, we'd detect quantifiers and push/pop boundVars
    const args = ct.args.map(convert);
    return { type: 'compound', op: ct.op, args };
  };

  const debruijn = convert(term);
  return { debruijn, freeVars };
}

/**
 * Hash a de Bruijn term.
 */
function hashDebrTerm(debruijn: DebrTerm): number {
  let hash = 0x9e3779b9;

  const hashTerm = (t: DebrTerm): number => {
    let h = 0;
    switch (t.type) {
      case 'var':
        h = Math.imul(t.index + 0x1000000, 0x85ebca6b);
        break;
      case 'const':
        h = hashString(t.value);
        break;
      case 'compound':
        h = hashString(t.op);
        for (const arg of t.args) {
          h = Math.imul(h ^ hashTerm(arg), 0x85ebca6b);
        }
        break;
    }
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  };

  hash = Math.imul(hash ^ hashTerm(debruijn), 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
  }
  return hash >>> 0;
}

/**
 * Compare two terms for canonical equality.
 * Returns true if they have the same canonical form.
 */
export function canonicalEquals(a: Term, b: Term, options?: Partial<CanonicalOptions>): boolean {
  const ca = canonicalize(a, options);
  const cb = canonicalize(b, options);
  return ca.hash === cb.hash && ca.freeVars.length === cb.freeVars.length &&
    ca.freeVars.every((v, i) => v === cb.freeVars[i]);
}

/**
 * Get canonical hash of a term.
 */
export function canonicalHash(term: Term, options?: Partial<CanonicalOptions>): number {
  return canonicalize(term, options).hash;
}

/**
 * Get canonical string representation (for debugging).
 */
export function canonicalString(term: Term, options?: Partial<CanonicalOptions>): string {
  const { debruijn, freeVars } = canonicalize(term, options);
  return `${debruijnToString(debruijn)} [free: ${freeVars.join(', ')}]`;
}

function debruijnToString(t: DebrTerm): string {
  switch (t.type) {
    case 'var':
      return t.index < 0 ? `?${t.index}` : `#${t.index}`;
    case 'const':
      return t.value;
    case 'compound': {
      const args = t.args;
      if (args.length === 1) {
        return `${t.op}(${debruijnToString(args[0]!)})`;
      }
      return `(${args.map(debruijnToString).join(` ${t.op} `)})`;
    }
  }
}

/**
 * Term index for fast lookup by canonical form.
 */
export class CanonicalIndex {
  private index = new Map<number, Term[]>();

  /** Add a term to the index. */
  add(term: Term, options?: Partial<CanonicalOptions>): void {
    const hash = canonicalHash(term, options);
    const existing = this.index.get(hash) ?? [];
    // Check for actual equality (hash collision possible)
    if (!existing.some(e => canonicalEquals(e, term, options))) {
      existing.push(term);
      this.index.set(hash, existing);
    }
  }

  /** Find terms canonically equal to the given term. */
  find(term: Term, options?: Partial<CanonicalOptions>): Term[] {
    const hash = canonicalHash(term, options);
    const candidates = this.index.get(hash) ?? [];
    return candidates.filter(c => canonicalEquals(c, term, options));
  }

  /** Check if a canonically equal term exists. */
  has(term: Term, options?: Partial<CanonicalOptions>): boolean {
    return this.find(term, options).length > 0;
  }

  /** Get all indexed terms. */
  getAll(): Term[] {
    const all: Term[] = [];
    for (const terms of this.index.values()) {
      all.push(...terms);
    }
    return all;
  }

  /** Clear the index. */
  clear(): void {
    this.index.clear();
  }

  /** Get index size. */
  size(): number {
    return this.index.size;
  }
}

/**
 * Create a canonical index from a collection of terms.
 */
export function createCanonicalIndex(terms: Term[], options?: Partial<CanonicalOptions>): CanonicalIndex {
  const index = new CanonicalIndex();
  for (const term of terms) index.add(term, options);
  return index;
}