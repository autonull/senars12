/**
 * Term Interning — global term identity management.
 *
 * Provides the single source of truth for term equality: two terms are
 * equal iff they are the same object (===). This is enforced by the
 * TermFactory which interns all created terms.
 */

import { TermFactory, Term, TermOp, VariableTerm, ConstantTerm, CompoundTerm } from './term.js';
import type { Frequency, Confidence, TruthLike } from '../types.js';

/** Interning statistics. */
export interface InternStats {
  totalTerms: number;
  variables: number;
  constants: number;
  compounds: number;
  byOp: Record<string, number>;
  memoryEstimate: number;
}

/** Global interning state. */
export class TermInterner {
  private factory: TermFactory;
  private enabled = true;

  constructor(factory: TermFactory = TermFactory.getInstance()) {
    this.factory = factory;
  }

  /** Enable/disable interning (for testing). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Check if interning is enabled. */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Intern a term (returns existing if already interned). */
  intern(term: Term): Term {
    if (!this.enabled) return term;
    // The factory already interns on creation, so this is a no-op
    // but provides a clear API for "ensure interned"
    return term;
  }

  /** Get interned variable or create new. */
  variable(name: string): VariableTerm {
    return this.factory.variable(name);
  }

  /** Get interned constant or create new. */
  constant(value: string): ConstantTerm {
    return this.factory.constant(value);
  }

  /** Get interned compound or create new. */
  compound(op: TermOp, ...args: Term[]): CompoundTerm {
    return this.factory.compound(op, ...args);
  }

  /** Parse and intern a Narsese string. */
  parse(narsese: string): Term {
    return this.factory.parse(narsese);
  }

  /** Format a term as Narsese. */
  format(term: Term): string {
    return this.factory.format(term);
  }

  /** Check equality by identity. */
  equals(a: Term, b: Term): boolean {
    return a === b;
  }

  /** Get term hash. */
  hash(term: Term): number {
    return this.factory.getHash(term);
  }

  /** Get term complexity. */
  complexity(term: Term): number {
    return this.factory.getComplexity(term);
  }

  /** Get interning statistics. */
  getStats(): InternStats {
    const allTerms = this.factory.getAllTerms();
    const byOp: Record<string, number> = {};
    let variables = 0, constants = 0, compounds = 0;

    for (const term of allTerms) {
      byOp[term.op] = (byOp[term.op] ?? 0) + 1;
      switch (term.op) {
        case TermOp.VARIABLE: variables++; break;
        case TermOp.CONSTANT: constants++; break;
        default: compounds++; break;
      }
    }

    // Rough memory estimate: 64 bytes per term + string data
    const memoryEstimate = allTerms.length * 64 +
      allTerms.reduce((sum, t) => sum + JSON.stringify(t).length, 0);

    return {
      totalTerms: allTerms.length,
      variables,
      constants,
      compounds,
      byOp,
      memoryEstimate,
    };
  }

  /** Clear all interned terms (for testing). */
  clear(): void {
    TermFactory.reset();
    this.factory = TermFactory.getInstance();
  }

  /** Get the underlying factory. */
  getFactory(): TermFactory {
    return this.factory;
  }
}

/** Global interner instance. */
export const termInterner = new TermInterner();

/**
 * Term equality that respects interning.
 * Returns true iff a and b are the exact same interned object.
 */
export function termEquals(a: Term, b: Term): boolean {
  return termInterner.equals(a, b);
}

/**
 * Term hash function.
 */
export function termHash(term: Term): number {
  return termInterner.hash(term);
}

/**
 * Term complexity function.
 */
export function termComplexity(term: Term): number {
  return termInterner.complexity(term);
}

/**
 * Create a term from a JSON-serializable representation.
 * Used for deserialization (e.g., from log, network).
 */
export function termFromJSON(json: TermJSON): Term {
  switch (json.op) {
    case 'var':
      return termInterner.variable(json.name);
    case 'const':
      return termInterner.constant(json.value);
    default:
      return termInterner.compound(
        json.op as TermOp,
        ...json.args.map(termFromJSON)
      );
  }
}

/** JSON representation of a term. */
export interface TermJSON {
  op: string;
  name?: string;
  value?: string;
  args?: TermJSON[];
}

/**
 * Convert a term to JSON-serializable form.
 */
export function termToJSON(term: Term): TermJSON {
  const base: TermJSON = { op: term.op };
  if (term.op === TermOp.VARIABLE) {
    base.name = (term as VariableTerm).name;
  } else if (term.op === TermOp.CONSTANT) {
    base.value = (term as ConstantTerm).value;
  } else {
    base.args = (term as CompoundTerm).args.map(termToJSON);
  }
  return base;
}

/**
 * Term visitor pattern for traversing term trees.
 */
export interface TermVisitor<T> {
  visitVariable(term: VariableTerm): T;
  visitConstant(term: ConstantTerm): T;
  visitCompound(term: CompoundTerm, children: T[]): T;
}

/**
 * Visit a term tree with a visitor.
 */
export function visitTerm<T>(term: Term, visitor: TermVisitor<T>): T {
  switch (term.op) {
    case TermOp.VARIABLE:
      return visitor.visitVariable(term);
    case TermOp.CONSTANT:
      return visitor.visitConstant(term);
    default:
      const children = (term as CompoundTerm).args.map(arg => visitTerm(arg, visitor));
      return visitor.visitCompound(term as CompoundTerm, children);
  }
}

/**
 * Map a term tree, transforming each node.
 */
export function mapTerm(term: Term, mapper: (term: Term) => Term): Term {
  const mapped = mapper(term);
  if (mapped !== term) return mapped;

  if (term.op === TermOp.VARIABLE || term.op === TermOp.CONSTANT) {
    return term;
  }

  const compound = term as CompoundTerm;
  const newArgs = compound.args.map(arg => mapTerm(arg, mapper));
  if (newArgs === compound.args) return term;

  return termInterner.compound(compound.op, ...newArgs);
}

/**
 * Find all subterms matching a predicate.
 */
export function findSubterms(term: Term, predicate: (term: Term) => boolean): Term[] {
  const results: Term[] = [];
  visitTerm(term, {
    visitVariable: (t) => { if (predicate(t)) results.push(t); return undefined as never; },
    visitConstant: (t) => { if (predicate(t)) results.push(t); return undefined as never; },
    visitCompound: (t, children) => { if (predicate(t)) results.push(t); return undefined as never; },
  });
  return results;
}

/**
 * Get all variables in a term.
 */
export function getVariables(term: Term): VariableTerm[] {
  return findSubterms(term, t => t.op === TermOp.VARIABLE) as VariableTerm[];
}

/**
 * Get all constants in a term.
 */
export function getConstants(term: Term): ConstantTerm[] {
  return findSubterms(term, t => t.op === TermOp.CONSTANT) as ConstantTerm[];
}

/**
 * Substitute variables in a term.
 */
export function substitute(term: Term, substitution: Map<VariableTerm, Term>): Term {
  return mapTerm(term, t => {
    if (t.op === TermOp.VARIABLE) {
      return substitution.get(t) ?? t;
    }
    return t;
  });
}

/**
 * Check if a term contains a variable.
 */
export function containsVariable(term: Term, variable: VariableTerm): boolean {
  return findSubterms(term, t => t === variable).length > 0;
}

/**
 * Get the set of all variables in a term.
 */
export function getVariableSet(term: Term): Set<VariableTerm> {
  return new Set(getVariables(term));
}

/**
 * Rename variables in a term to avoid capture.
 */
export function renameVariables(term: Term, prefix = 'v'): Term {
  const mapping = new Map<VariableTerm, VariableTerm>();
  let counter = 0;

  return mapTerm(term, t => {
    if (t.op === TermOp.VARIABLE) {
      let newVar = mapping.get(t);
      if (!newVar) {
        newVar = termInterner.variable(`${prefix}${counter++}`);
        mapping.set(t, newVar);
      }
      return newVar;
    }
    return t;
  });
}

/**
 * Standardize variables apart (rename to fresh variables).
 */
export function standardizeApart(term: Term): Term {
  return renameVariables(term);
}

/**
 * Check if two terms are unifiable (without performing unification).
 * Quick syntactic check.
 */
export function isUnifiable(a: Term, b: Term): boolean {
  if (a === b) return true;
  if (a.op === TermOp.VARIABLE || b.op === TermOp.VARIABLE) return true;
  if (a.op !== b.op) return false;
  if (a.op === TermOp.CONSTANT && b.op === TermOp.CONSTANT) {
    return (a as ConstantTerm).value === (b as ConstantTerm).value;
  }
  const ca = a as CompoundTerm;
  const cb = b as CompoundTerm;
  if (ca.arity !== cb.arity) return false;
  for (let i = 0; i < ca.arity; i++) {
    if (!isUnifiable(ca.args[i], cb.args[i])) return false;
  }
  return true;
}

// Re-export shared types
export type { TruthValue, Stamp } from '../types.js';
export { TermFactory, Term, TermOp, VariableTerm, ConstantTerm, CompoundTerm } from './term.js';