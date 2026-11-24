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

/** Rename variables in a term. */
export function renameVariables(term: Term, mapping: Map<string, string>): Term {
  if (isVariable(term)) {
    const newName = mapping.get(term.name);
    if (newName) {
      return { ...term, name: newName };
    }
    return term;
  }
  if (term.op === TermOp.CONSTANT) return term;

  const newArgs = term.args.map((arg) => renameVariables(arg, mapping));
  if (newArgs === term.args) return term;
  return { ...term, args: newArgs };
}

/** Substitute variables in a term. */
export function substituteVariables(term: Term, substitution: Map<string, Term>): Term {
  if (isVariable(term)) {
    const replacement = substitution.get(term.name);
    if (replacement) return replacement;
    return term;
  }
  if (term.op === TermOp.CONSTANT) return term;

  const newArgs = term.args.map((arg) => substituteVariables(arg, substitution));
  if (newArgs === term.args) return term;
  return { ...term, args: newArgs };
}

/** Get all variable names in a term. */
export function getVariableNames(term: Term): Set<string> {
  const names = new Set<string>();

  function collect(t: Term): void {
    if (isVariable(t)) {
      names.add(t.name);
    } else if (t.op !== TermOp.CONSTANT) {
      for (const arg of t.args) {
        collect(arg);
      }
    }
  }

  collect(term);
  return names;
}

/** Check if term is ground (no variables). */
export function isGround(term: Term): boolean {
  return getVariableNames(term).size === 0;
}