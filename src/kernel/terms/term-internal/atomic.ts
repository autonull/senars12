/**
 * Atomic Term Operations — utilities for variable and constant terms.
 */

import type { Term, VariableTerm, ConstantTerm } from './types';
import { TermOp } from '../term-ops';

/** Check if term is a variable. */
export function isVariable(term: Term): term is VariableTerm {
  return term.op === TermOp.VARIABLE;
}

/** Check if term is a constant. */
export function isConstant(term: Term): term is ConstantTerm {
  return term.op === TermOp.CONSTANT;
}

/** Get variable name. */
export function getVariableName(term: Term): string | null {
  if (isVariable(term)) return term.name;
  return null;
}

/** Get constant value. */
export function getConstantValue(term: Term): string | null {
  if (isConstant(term)) return term.value;
  return null;
}

/** Create a variable term from index. */
export function variableFromIndex(index: number, prefix = '_'): VariableTerm {
  return { op: TermOp.VARIABLE, name: `${prefix}${index}`, index, hash: 0, complexity: 1 };
}