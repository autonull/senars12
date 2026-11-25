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

import { Term, TermOp, VariableTerm, ConstantTerm, CompoundTerm, termInterner, getArgs } from './intern';

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
 * Single-pass normalization + de Bruijn conversion + hashing.
 */
export function canonicalize(term: Term, options: Partial<CanonicalOptions> = {}): CanonicalTerm {
  const opts = { ...defaultCanonicalOptions, ...options };

  // Single-pass: normalize and convert to de Bruijn simultaneously
  const boundVars = new Map<VariableTerm, number>();
  const freeVars: string[] = [];

  const normalizeAndConvert = (t: Term): DebrTerm => {
    // Handle implication/equivalence normalization first
    if (opts.normalizeImplication) {
      const args = getArgs(t);
      if (args) {
        if (t.op === TermOp.IMPLICATION) {
          // A ==> B becomes ~A | B
          const antecedent = args[0]!;
          const consequent = args[1]!;
          const negAntecedent = termInterner.negation(antecedent);
          const disjunction = termInterner.disjunction(negAntecedent, consequent);
          return normalizeAndConvert(disjunction);
        }
        if (t.op === TermOp.EQUIVALENCE) {
          // A <=> B becomes (A ==> B) & (B ==> A)
          const left = args[0]!;
          const right = args[1]!;
          const impl1 = termInterner.implication(left, right);
          const impl2 = termInterner.implication(right, left);
          const conjunction = termInterner.conjunction(impl1, impl2);
          return normalizeAndConvert(conjunction);
        }
      }
    }

    // Handle double negation elimination
    if (opts.eliminateDoubleNegation && t.op === TermOp.NEGATION) {
      const args = getArgs(t);
      if (args && args.length > 0) {
        const firstArg = args[0]!;
        if (firstArg.op === TermOp.NEGATION) {
          const innerArgs = getArgs(firstArg);
          if (innerArgs && innerArgs.length > 0) {
            return normalizeAndConvert(innerArgs[0]!);
          }
        }
      }
    }

    // Handle variables
    if (t.op === TermOp.VARIABLE) {
      const vt = t as VariableTerm;
      const idx = boundVars.get(vt);
      if (idx !== undefined) {
        return { type: 'var', index: idx };
      }
      // Free variable
      const freeIdx = freeVars.indexOf(vt.name);
      if (freeIdx >= 0) {
        return { type: 'var', index: -(freeIdx + 1) };
      }
      freeVars.push(vt.name);
      return { type: 'var', index: -freeVars.length };
    }

    // Handle constants
    if (t.op === TermOp.CONSTANT) {
      return { type: 'const', value: (t as ConstantTerm).value };
    }

    // Handle compounds
    const ct = t as CompoundTerm;
    let args = ct.args;

    // Flatten associative operators
    if (opts.flattenAssociative && ASSOCIATIVE_OPS.has(ct.op)) {
      const flattened: Term[] = [];
      const collect = (arg: Term) => {
        if (arg.op === ct.op) {
          for (const a of (arg as CompoundTerm).args) collect(a);
        } else {
          flattened.push(arg);
        }
      };
      for (const arg of args) collect(arg);
      args = flattened;
    }

    // Sort commutative arguments
    if (opts.sortCommutative && COMMUTATIVE_OPS.has(ct.op) && args.length > 1) {
      args = [...args].sort((a, b) => termInterner.hash(a) - termInterner.hash(b));
    }

    // Recursively convert arguments
    const debruijnArgs = args.map(normalizeAndConvert);

    return { type: 'compound', op: ct.op, args: debruijnArgs };
  };

  const debruijn = normalizeAndConvert(term);
  const hash = hashDebrTerm(debruijn);

  return { hash, debruijn, freeVars };
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