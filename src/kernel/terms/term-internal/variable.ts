/**
 * Variable Term Operations — advanced variable manipulation.
 */

import type { Term, VariableTerm } from './types';
import { TermOp } from '../term-ops';
import { termFactory } from './factory';
import { unify as unifyImpl, applySubstitution as applySubstImpl } from '../unify';

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

/** Get most general unifier. */
export function mgu(a: Term, b: Term): Map<string, Term> | null {
  const result = unifyImpl(a, b, {});
  if (result.success && result.substitution) {
    return result.substitution as unknown as Map<string, Term>;
  }
  return null;
}

/** Check if two terms are unifiable. */
export function isUnifiable(a: Term, b: Term): boolean {
  const result = unifyImpl(a, b, {});
  return result.success;
}