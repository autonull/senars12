/**
 * Variable Term Operations — advanced variable manipulation.
 */

import type { Term, VariableTerm } from './types';
import { TermOp } from '../term-ops';
import { termFactory } from './factory';

/** Variable generator for creating fresh variables. */
export class VariableGenerator {
  private counter = 0;
  private prefix = '_';

  constructor(prefix = '_') {
    this.prefix = prefix;
  }

  /** Generate a fresh variable. */
  fresh(): VariableTerm {
    return termFactory.variable(`${this.prefix}${this.counter++}`);
  }

  /** Generate a named variable. */
  named(name: string): VariableTerm {
    return termFactory.variable(name);
  }

  /** Reset the counter. */
  reset(): void {
    this.counter = 0;
  }

  /** Set the counter. */
  setCounter(value: number): void {
    this.counter = value;
  }

  /** Get current counter. */
  getCounter(): number {
    return this.counter;
  }
}

/** Default variable generator. */
export const variableGenerator = new VariableGenerator();

/** Unify two terms with variable substitution. */
export function unify(a: Term, b: Term, substitution: Map<string, Term> = new Map()): Map<string, Term> | null {
  // Occurs check
  function occursCheck(v: VariableTerm, t: Term, sub: Map<string, Term>): boolean {
    if (t.op === TermOp.VARIABLE) {
      if (t.name === v.name) return true;
      const subbed = sub.get(t.name);
      return subbed ? occursCheck(v, subbed, sub) : false;
    }
    if (t.op !== TermOp.CONSTANT) {
      return t.args.some((arg) => occursCheck(v, arg, sub));
    }
    return false;
  }

  function unifyTerms(x: Term, y: Term, sub: Map<string, Term>): Map<string, Term> | null {
    // Apply substitution
    const applySub = (t: Term): Term => {
      if (t.op === TermOp.VARIABLE) {
        return sub.get(t.name) ?? t;
      }
      if (t.op === TermOp.CONSTANT) return t;
      const newArgs = t.args.map(applySub);
      if (newArgs === t.args) return t;
      return { ...t, args: newArgs };
    };

    const xSub = applySub(x);
    const ySub = applySub(y);

    // Same term
    if (xSub.hash === ySub.hash) return sub;

    // Variable unification
    if (xSub.op === TermOp.VARIABLE) {
      if (occursCheck(xSub, ySub, sub)) return null;
      sub.set(xSub.name, ySub);
      return sub;
    }
    if (ySub.op === TermOp.VARIABLE) {
      if (occursCheck(ySub, xSub, sub)) return null;
      sub.set(ySub.name, xSub);
      return sub;
    }

    // Both constants
    if (xSub.op === TermOp.CONSTANT && ySub.op === TermOp.CONSTANT) {
      return xSub.value === ySub.value ? sub : null;
    }

    // One constant, one compound - fail
    if (xSub.op === TermOp.CONSTANT || ySub.op === TermOp.CONSTANT) {
      return null;
    }

    // Both compounds - unify args
    if (xSub.op !== ySub.op || xSub.arity !== ySub.arity) {
      return null;
    }

    let newSub = sub;
    for (let i = 0; i < xSub.arity; i++) {
      const result = unifyTerms(xSub.args[i]!, ySub.args[i]!, newSub);
      if (!result) return null;
      newSub = result;
    }
    return newSub;
  }

  return unifyTerms(a, b, substitution);
}

/** Apply substitution to term. */
export function applySubstitution(term: Term, substitution: Map<string, Term>): Term {
  if (term.op === TermOp.VARIABLE) {
    return substitution.get(term.name) ?? term;
  }
  if (term.op === TermOp.CONSTANT) return term;

  const newArgs = term.args.map((arg) => applySubstitution(arg, substitution));
  if (newArgs === term.args) return term;
  return { ...term, args: newArgs };
}

/** Get most general unifier. */
export function mgu(a: Term, b: Term): Map<string, Term> | null {
  return unify(a, b, new Map());
}

/** Check if two terms are unifiable. */
export function isUnifiable(a: Term, b: Term): boolean {
  return unify(a, b, new Map()) !== null;
}

/** Standardize variables apart (rename to avoid conflicts). */
export function standardizeApart(term: Term, prefix = '_'): Term {
  const generator = new VariableGenerator(prefix);
  const mapping = new Map<string, string>();

  function rename(t: Term): Term {
    if (t.op === TermOp.VARIABLE) {
      const newName = mapping.get(t.name) ?? (() => {
        const n = generator.fresh().name;
        mapping.set(t.name, n);
        return n;
      })();
      return { ...t, name: newName };
    }
    if (t.op === TermOp.CONSTANT) return t;

    const newArgs = t.args.map(rename);
    if (newArgs === t.args) return t;
    return { ...t, args: newArgs };
  }

  return rename(term);
}